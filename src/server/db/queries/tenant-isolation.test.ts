import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { createEntry, deleteEntry, getEntry, getEntryCounts, listEntries } from "./applications";
import { exportAccount } from "./account";
import { createScope } from "./scope";

/**
 * The definition-of-done test: one user tries to read, export and delete
 * another user's entries, and gets nothing every time.
 *
 * Needs a throwaway database. Run it with:
 *   TEST_DATABASE_URL="postgresql://…" pnpm test
 * It creates two users, cleans up after itself, and touches nothing else.
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("tenant isolation", () => {
  const alice = { id: `test-alice-${Date.now()}`, email: `alice-${Date.now()}@docket.test` };
  const mallory = { id: `test-mallory-${Date.now()}`, email: `mallory-${Date.now()}@docket.test` };

  const aliceScope = createScope(alice.id);
  const malloryScope = createScope(mallory.id);

  let aliceEntryId = "";

  beforeAll(async () => {
    await db.insert(users).values([
      { id: alice.id, email: alice.email },
      { id: mallory.id, email: mallory.email },
    ]);

    const created = await createEntry(aliceScope, {
      company: "Loudly",
      website: "loudly.com",
      position: "Senior Frontend Developer",
      city: "Berlin",
      country: "Germany",
      notes: "private note",
      jobDescription: "React, TypeScript",
      tags: ["React", "TypeScript"],
    });
    aliceEntryId = created.id;
  });

  afterAll(async () => {
    // Applications, tags and status events cascade from the user row.
    await db.delete(users).where(eq(users.id, alice.id));
    await db.delete(users).where(eq(users.id, mallory.id));
  });

  it("gives the owner their entry", async () => {
    const entry = await getEntry(aliceScope, aliceEntryId);
    expect(entry?.company).toBe("Loudly");
    expect(entry?.protocolNumber).toBe(1);
  });

  it("does not let another user read the entry by id", async () => {
    expect(await getEntry(malloryScope, aliceEntryId)).toBeNull();
  });

  it("does not let another user see the entry in a listing", async () => {
    expect(await listEntries(malloryScope)).toEqual([]);
    expect(await listEntries(malloryScope, { search: "Loudly" })).toEqual([]);
  });

  it("does not count another user's entries", async () => {
    expect((await getEntryCounts(malloryScope)).total).toBe(0);
    expect((await getEntryCounts(aliceScope)).total).toBe(1);
  });

  it("does not let another user delete the entry", async () => {
    expect(await deleteEntry(malloryScope, aliceEntryId)).toBe(false);
    expect(await getEntry(aliceScope, aliceEntryId)).not.toBeNull();
  });

  it("does not leak the entry into another user's data export", async () => {
    expect((await exportAccount(malloryScope)).entries).toEqual([]);
    expect((await exportAccount(aliceScope)).entries).toHaveLength(1);
  });

  it("numbers protocols per user, not globally", async () => {
    const malloryEntry = await createEntry(malloryScope, {
      company: "Neon",
      website: null,
      position: "DevRel",
      city: null,
      country: null,
      notes: null,
      jobDescription: null,
      tags: ["PostgreSQL"],
    });
    const entry = await getEntry(malloryScope, malloryEntry.id);
    expect(entry?.protocolNumber).toBe(1);
  });

  it("lets the owner delete their own entry", async () => {
    expect(await deleteEntry(aliceScope, aliceEntryId)).toBe(true);
    expect(await getEntry(aliceScope, aliceEntryId)).toBeNull();
  });
});
