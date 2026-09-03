import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import {
  createEntry,
  deleteEntry,
  getEntry,
  getEntryCounts,
  getEntryDossier,
  listEntries,
} from "./applications";
import { exportAccount } from "./account";
import { fileRejection, getRejectionCounts, listRejections, reopenApplication } from "./rejections";
import { createScope } from "./scope";
import {
  confirmImport,
  countAnalysesFor,
  countAnalysesThisMonth,
  createImport,
  createResume,
  deleteChange,
  deleteImport,
  deleteResume,
  duplicateResume,
  getAnalysis,
  getChange,
  getImport,
  getLatestAnalysis,
  getPendingImport,
  getResume,
  getResumeById,
  listChanges,
  listResumes,
  markResumeUsed,
  recordChange,
  renameResume,
  saveAnalysis,
  saveResumeContent,
  setActiveResume,
} from "./resumes";
import { cloneResume } from "@/lib/resume/edit";
import { computeCoverage } from "@/lib/tailoring/matching";
import { fingerprintJob, fingerprintResume } from "@/lib/tailoring/fingerprint";
import { JOB_MATCH_SCORING_VERSION } from "@/lib/tailoring/score";
import { readJobDescription } from "@/lib/tailoring/heuristics";
import { SAMPLE_JOB, sampleResume } from "@/test/resume";

/**
 * The definition-of-done test: one user tries to read, export and delete
 * another user's entries, and gets nothing every time.
 *
 * Needs a throwaway database. Run it with:
 *   TEST_DATABASE_URL="postgresql://…" pnpm test
 * It creates two users, cleans up after itself, and touches nothing else.
 */
const url = process.env.TEST_DATABASE_URL;

/** One stored reading, shaped exactly as the analysis pipeline produces it. */
function analysisFixture() {
  const jobAnalysis = readJobDescription(SAMPLE_JOB);
  const { jobMatch, coverage, explanation } = computeCoverage(sampleResume(), jobAnalysis);

  return {
    jobAnalysis,
    coverage,
    jobMatch,
    explanation,
    suggestions: [],
    source: "heuristic" as const,
    analyzedAt: new Date().toISOString(),
  };
}

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
      benefits: [],
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

  it("gives the owner the whole dossier, the stored advert included", async () => {
    const dossier = await getEntryDossier(aliceScope, aliceEntryId);
    expect(dossier?.jobDescription).toBe("React, TypeScript");
    expect(dossier?.tags).toEqual(["React", "TypeScript"]);
    expect(dossier?.rejectedAt).toBeNull();
    // createEntry writes the opening status event, so the history is never empty.
    expect(dossier?.events).toHaveLength(1);
    expect(dossier?.interviews).toEqual([]);
  });

  /**
   * The dossier is the one read that returns the job advert in full, so it is
   * the one worth checking twice: a missing owner filter here would hand a
   * stranger the whole entry rather than a row of it.
   */
  it("does not let another user open the dossier", async () => {
    expect(await getEntryDossier(malloryScope, aliceEntryId)).toBeNull();
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
      benefits: [],
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
      benefits: [],
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

/**
 * The CV is the most personal thing this product stores, and it is stored as
 * one JSON blob rather than as columns — which makes it the row where a missing
 * owner filter would hand over a whole document rather than a field of one. The
 * same crossing is tried for the document, its readings, its change history and
 * the export.
 */
describe.skipIf(!url)("the CV and its readings", () => {
  const holder = { id: `test-holder-${Date.now()}`, email: `holder-${Date.now()}@docket.test` };
  const outsider = {
    id: `test-outsider-${Date.now()}`,
    email: `outsider-${Date.now()}@docket.test`,
  };

  const holderScope = createScope(holder.id);
  const outsiderScope = createScope(outsider.id);

  let resumeId = "";
  let analysisId = "";
  let changeId = "";

  beforeAll(async () => {
    await db.insert(users).values([
      { id: holder.id, email: holder.email },
      { id: outsider.id, email: outsider.email },
    ]);

    const created = await createResume(holderScope, {
      title: "My CV",
      content: sampleResume(),
    });
    resumeId = created.id;

    const analysis = await saveAnalysis(holderScope, {
      resumeId,
      applicationId: null,
      jobDescription: SAMPLE_JOB,
      resumeFingerprint: fingerprintResume(sampleResume()),
      jobFingerprint: fingerprintJob(SAMPLE_JOB),
      scoringVersion: JOB_MATCH_SCORING_VERSION,
      promptVersion: "2",
      analysis: analysisFixture(),
      model: "heuristic",
    });
    analysisId = analysis.id;

    changeId = `chg-${Date.now()}`;
    await recordChange(holderScope, {
      resumeId,
      analysisId,
      change: {
        id: changeId,
        suggestionId: "h-1",
        targetId: "experience/exp-loudly/bullets/bul-1",
        target: {
          sectionId: "experience",
          entryId: "exp-loudly",
          fieldId: "bullets",
          itemId: "bul-1",
        },
        previousValue: "Worked on frontend performance.",
        nextValue: "Owned frontend performance.",
        createdAt: new Date().toISOString(),
      },
    });
  });

  afterAll(async () => {
    // Résumés, readings and changes cascade from the user row.
    await db.delete(users).where(eq(users.id, holder.id));
    await db.delete(users).where(eq(users.id, outsider.id));
  });

  it("gives the owner their document, and the copy it arrived as", async () => {
    const record = await getResume(holderScope);
    expect(record?.id).toBe(resumeId);
    expect(record?.content.personal.fullName).toBe("Ana Ribeiro");
    expect(record?.original.personal.fullName).toBe("Ana Ribeiro");
  });

  it("does not let another user read the document", async () => {
    expect(await getResume(outsiderScope)).toBeNull();
  });

  it("does not let another user write into it", async () => {
    const edited = sampleResume();
    edited.personal.fullName = "Someone Else";

    expect(await saveResumeContent(outsiderScope, resumeId, edited)).toBe(false);
    expect((await getResume(holderScope))?.content.personal.fullName).toBe("Ana Ribeiro");
  });

  it("does not let another user read a reading", async () => {
    expect(await getAnalysis(outsiderScope, analysisId)).toBeNull();
    expect(await getLatestAnalysis(outsiderScope, resumeId)).toBeNull();
    expect((await getAnalysis(holderScope, analysisId))?.jobDescription).toBe(SAMPLE_JOB);
  });

  it("does not count another user's readings against their allowance", async () => {
    expect(await countAnalysesThisMonth(outsiderScope)).toBe(0);
    expect(await countAnalysesThisMonth(holderScope)).toBe(1);
  });

  it("does not let another user read, or undo, an applied change", async () => {
    expect(await getChange(outsiderScope, changeId)).toBeNull();
    expect(await deleteChange(outsiderScope, changeId)).toBe(false);
    expect(await listChanges(outsiderScope, resumeId)).toEqual([]);

    const mine = await listChanges(holderScope, resumeId);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.previousValue).toBe("Worked on frontend performance.");
  });

  it("does not leak the CV into another user's export", async () => {
    expect((await exportAccount(outsiderScope)).cv).toBeUndefined();

    const mine = await exportAccount(holderScope);
    expect(mine.cv?.title).toBe("My CV");
    expect(mine.cv?.readings).toHaveLength(1);
  });

  it("lets the owner undo their own change", async () => {
    expect(await deleteChange(holderScope, changeId)).toBe(true);
    expect(await getChange(holderScope, changeId)).toBeNull();
  });
});

/**
 * An imported PDF is the most sensitive row this product writes: it holds
 * somebody's CV as a file, not only as fields. Nothing about it may be
 * reachable by anyone else — not the reading, not the file, not the fact that
 * an import exists.
 */
describe.skipIf(!url)("an imported CV", () => {
  const owner = { id: `test-import-${Date.now()}`, email: `import-${Date.now()}@docket.test` };
  const other = { id: `test-other-${Date.now()}`, email: `other-${Date.now()}@docket.test` };

  const ownerScope = createScope(owner.id);
  const otherScope = createScope(other.id);

  let importId = "";

  beforeAll(async () => {
    await db.insert(users).values([
      { id: owner.id, email: owner.email },
      { id: other.id, email: other.email },
    ]);

    const record = await createImport(ownerScope, {
      fileName: "ana-ribeiro-cv.pdf",
      byteSize: 4_096,
      pageCount: 1,
      checksum: "a".repeat(64),
      fileData: Buffer.from("%PDF-1.7 pretend").toString("base64"),
      extractedText: "Ana Ribeiro\nFrontend Engineer",
      result: {
        resume: sampleResume(),
        warnings: [],
        unclassifiedContent: [],
        uncertain: [],
        requiresReview: true,
        source: "heuristic",
      },
    });
    importId = record.id;
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, owner.id));
    await db.delete(users).where(eq(users.id, other.id));
  });

  it("is waiting for its owner to review it", async () => {
    const pending = await getPendingImport(ownerScope);
    expect(pending?.id).toBe(importId);
    expect(pending?.fileName).toBe("ana-ribeiro-cv.pdf");
  });

  it("does not exist as far as anyone else is concerned", async () => {
    expect(await getPendingImport(otherScope)).toBeNull();
    expect(await getImport(otherScope, importId)).toBeNull();
  });

  it("cannot be confirmed or thrown away by anyone else", async () => {
    const theirs = await createResume(otherScope, { title: "Theirs", content: sampleResume() });

    expect(await confirmImport(otherScope, importId, theirs.id)).toBe(false);
    expect(await deleteImport(otherScope, importId)).toBe(false);
    expect(await getImport(ownerScope, importId)).not.toBeNull();
  });

  it("stops being pending once its owner confirms it", async () => {
    const mine = await createResume(ownerScope, { title: "Mine", content: sampleResume() });

    expect(await confirmImport(ownerScope, importId, mine.id)).toBe(true);
    expect(await getPendingImport(ownerScope)).toBeNull();
    // Confirmed, not deleted: the file stays as the document's provenance.
    expect(await getImport(ownerScope, importId)).not.toBeNull();
  });

  it("lets its owner throw it away", async () => {
    expect(await deleteImport(ownerScope, importId)).toBe(true);
    expect(await getImport(ownerScope, importId)).toBeNull();
  });
});

/**
 * The library: several CVs on one account, and the rule that one account's
 * documents are invisible and untouchable to another.
 *
 * The destructive paths are the ones worth the round trip. A delete that
 * quietly leaves the readings and the imported file behind would be a product
 * that says "permanently deleted" and means "hidden".
 */
describe.skipIf(!url)("a library of CVs", () => {
  const owner = { id: `test-lib-${Date.now()}`, email: `lib-${Date.now()}@docket.test` };
  const stranger = { id: `test-peek-${Date.now()}`, email: `peek-${Date.now()}@docket.test` };

  const ownerScope = createScope(owner.id);
  const strangerScope = createScope(stranger.id);

  let generalId = "";
  let tailoredId = "";

  beforeAll(async () => {
    await db.insert(users).values([
      { id: owner.id, email: owner.email },
      { id: stranger.id, email: stranger.email },
    ]);

    const general = await createResume(ownerScope, {
      title: "General CV",
      content: sampleResume(),
      source: "pdf",
      originalFileName: "ana-cv.pdf",
    });
    generalId = general.id;

    const tailored = await createResume(ownerScope, {
      title: "Frontend CV",
      content: sampleResume(),
      source: "manual",
    });
    tailoredId = tailored.id;

    await setActiveResume(ownerScope, tailoredId);
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, owner.id));
    await db.delete(users).where(eq(users.id, stranger.id));
  });

  it("lists both, most recently touched first, and marks the one in the editor", async () => {
    const library = await listResumes(ownerScope);

    expect(library.map((entry) => entry.title)).toEqual(["Frontend CV", "General CV"]);
    expect(library.find((entry) => entry.active)?.id).toBe(tailoredId);
    expect(library.find((entry) => entry.id === generalId)?.source).toBe("pdf");
    expect(library.find((entry) => entry.id === generalId)?.originalFileName).toBe("ana-cv.pdf");
  });

  it("opens the one the account points at", async () => {
    expect((await getResume(ownerScope))?.id).toBe(tailoredId);

    await setActiveResume(ownerScope, generalId);
    expect((await getResume(ownerScope))?.id).toBe(generalId);

    await setActiveResume(ownerScope, tailoredId);
  });

  it("shows a stranger none of it", async () => {
    expect(await listResumes(strangerScope)).toEqual([]);
    expect(await getResumeById(strangerScope, tailoredId)).toBeNull();
    expect(await getResume(strangerScope)).toBeNull();
  });

  it("cannot be renamed, copied, pointed at or deleted by a stranger", async () => {
    expect(await renameResume(strangerScope, tailoredId, "Mine now")).toBe(false);
    expect(
      await duplicateResume(strangerScope, tailoredId, {
        title: "Stolen",
        content: sampleResume(),
      }),
    ).toBeNull();
    expect(await setActiveResume(strangerScope, tailoredId)).toBe(false);
    expect(await deleteResume(strangerScope, tailoredId)).toBe(false);

    expect((await getResumeById(ownerScope, tailoredId))?.title).toBe("Frontend CV");
  });

  it("copies into a document that shares nothing with its source", async () => {
    const source = (await getResumeById(ownerScope, generalId))!;
    const copy = await duplicateResume(ownerScope, generalId, {
      title: "General CV — Jane Street",
      content: cloneResume(source.content),
    });

    expect(copy).not.toBeNull();
    expect(copy!.id).not.toBe(generalId);
    expect(copy!.source).toBe("duplicate");

    // Editing the copy leaves the original exactly as it was.
    const edited = cloneResume(source.content);
    edited.summary.text = "Rewritten for Jane Street.";
    await saveResumeContent(ownerScope, copy!.id, edited);

    expect((await getResumeById(ownerScope, generalId))?.content.summary.text).toBe(
      source.content.summary.text,
    );

    await deleteResume(ownerScope, copy!.id);
  });

  it("records when a CV was last read against an advert", async () => {
    await markResumeUsed(ownerScope, tailoredId);
    expect((await getResumeById(ownerScope, tailoredId))?.lastUsedAt).not.toBeNull();
  });

  it("takes the readings, the changes and the imported file with the CV", async () => {
    const analysis = await saveAnalysis(ownerScope, {
      resumeId: generalId,
      applicationId: null,
      jobDescription: SAMPLE_JOB,
      resumeFingerprint: fingerprintResume(sampleResume()),
      jobFingerprint: fingerprintJob(SAMPLE_JOB),
      scoringVersion: JOB_MATCH_SCORING_VERSION,
      promptVersion: "2",
      analysis: analysisFixture(),
      model: "heuristic",
    });

    const imported = await createImport(ownerScope, {
      fileName: "ana-cv.pdf",
      byteSize: 2_048,
      pageCount: 1,
      checksum: "b".repeat(64),
      fileData: "JVBERi0=",
      extractedText: "Ana Ribeiro",
      result: {
        resume: sampleResume(),
        warnings: [],
        unclassifiedContent: [],
        uncertain: [],
        requiresReview: false,
        source: "heuristic",
      },
    });
    await confirmImport(ownerScope, imported.id, generalId);

    expect(await countAnalysesFor(ownerScope, generalId)).toBe(1);

    expect(await deleteResume(ownerScope, generalId)).toBe(true);

    expect(await getResumeById(ownerScope, generalId)).toBeNull();
    expect(await getAnalysis(ownerScope, analysis.id)).toBeNull();
    expect(await getImport(ownerScope, imported.id)).toBeNull();
  });

  it("clears the editor rather than opening another CV when the active one goes", async () => {
    const another = await createResume(ownerScope, { title: "Spare CV", content: sampleResume() });
    await setActiveResume(ownerScope, tailoredId);

    expect(await deleteResume(ownerScope, tailoredId)).toBe(true);

    // Two documents and no pointer is a question, and the answer is the
    // person's — section 18 forbids answering it for them.
    expect(await getResume(ownerScope)).toBeNull();

    await setActiveResume(ownerScope, another.id);
    expect((await getResume(ownerScope))?.id).toBe(another.id);
  });

  it("lets the last CV be deleted too", async () => {
    for (const entry of await listResumes(ownerScope)) {
      await deleteResume(ownerScope, entry.id);
    }

    expect(await listResumes(ownerScope)).toEqual([]);
    expect(await getResume(ownerScope)).toBeNull();
  });
});
