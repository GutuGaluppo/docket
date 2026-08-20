import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { createEntry, deleteEntry, getEntry, getEntryCounts, listEntries } from "./applications";
import { exportAccount } from "./account";
import { fileRejection, getRejectionCounts, listRejections, reopenApplication } from "./rejections";
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

/**
 * The archive is a second listing of the same table, which is exactly where a
 * tenant filter is easiest to forget. Filing, reading and reopening are each
 * tried across the boundary as well as by the owner.
 */
describe.skipIf(!url)("the rejection archive", () => {
  const owner = { id: `test-owner-${Date.now()}`, email: `owner-${Date.now()}@docket.test` };
  const stranger = {
    id: `test-stranger-${Date.now()}`,
    email: `stranger-${Date.now()}@docket.test`,
  };

  const ownerScope = createScope(owner.id);
  const strangerScope = createScope(stranger.id);

  let entryId = "";

  beforeAll(async () => {
    await db.insert(users).values([
      { id: owner.id, email: owner.email },
      { id: stranger.id, email: stranger.email },
    ]);

    const created = await createEntry(ownerScope, {
      company: "Hallmark",
      website: null,
      position: "Backend Engineer",
      city: "Lisbon",
      country: "Portugal",
      notes: null,
      jobDescription: null,
      tags: ["Go"],
    });
    entryId = created.id;
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, owner.id));
    await db.delete(users).where(eq(users.id, stranger.id));
  });

  it("does not let a stranger file someone else's application", async () => {
    const result = await fileRejection(strangerScope, entryId, "not for you");
    expect(result.ok).toBe(false);
    expect((await getRejectionCounts(ownerScope)).total).toBe(0);
  });

  it("files a refusal with the column it had reached", async () => {
    const result = await fileRejection(ownerScope, entryId, "Position put on hold");
    expect(result.ok).toBe(true);

    const [filed] = await listRejections(ownerScope);
    expect(filed?.company).toBe("Hallmark");
    expect(filed?.rejectionNote).toBe("Position put on hold");
    expect(filed?.rejectedAtStage).toBe("Application sent");
    expect(filed?.interviewCount).toBe(0);
  });

  it("takes the entry out of the open register without deleting it", async () => {
    expect(await listEntries(ownerScope)).toEqual([]);
    expect(await listEntries(ownerScope, { filter: "rejected" })).toHaveLength(1);

    const counts = await getEntryCounts(ownerScope);
    expect(counts.total).toBe(1);
    expect(counts.open).toBe(0);
    expect(counts.rejected).toBe(1);

    // The entry itself is untouched: same number, same stamp, still readable.
    expect((await getEntry(ownerScope, entryId))?.protocolNumber).toBe(1);
  });

  it("refuses to file the same refusal twice", async () => {
    const again = await fileRejection(ownerScope, entryId, null);
    expect(again.ok).toBe(false);
  });

  it("does not show one user's archive to another", async () => {
    expect(await listRejections(strangerScope)).toEqual([]);
    expect((await getRejectionCounts(strangerScope)).total).toBe(0);
  });

  it("does not let a stranger reopen a filed application", async () => {
    expect((await reopenApplication(strangerScope, entryId)).ok).toBe(false);
    expect((await getRejectionCounts(ownerScope)).total).toBe(1);
  });

  it("reopens into the column the refusal came from", async () => {
    expect((await reopenApplication(ownerScope, entryId)).ok).toBe(true);

    const [reopened] = await listEntries(ownerScope);
    expect(reopened?.company).toBe("Hallmark");
    expect(reopened?.stage).toBe("Application sent");
    expect(await listRejections(ownerScope)).toEqual([]);
  });
});
