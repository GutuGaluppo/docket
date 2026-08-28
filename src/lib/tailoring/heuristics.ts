import { TECHNOLOGIES, detectStack } from "@/lib/stack-detector";

import { aliasesFor, EQUIVALENCES } from "./equivalences";
import { STOP_WORDS, containsTerm, normalize } from "./match";
import type {
  JobAnalysis,
  JobKeyword,
  JobRequirement,
  RequirementCategory,
  RequirementImportance,
} from "./types";

/**
 * Reading a job advert into requirements, without asking anything of a model.
 *
 * Two reasons this exists rather than the reading being a single model call.
 * The first is that the product has to work when no key is configured — the
 * figure, the gaps and the recommendations are all usable on this reading
 * alone. The second is that it is the floor: whatever a model returns is merged
 * on top of it, so a model that answers with nothing still leaves a reading
 * behind, and one that answers with something wrong is measured against a
 * reading that came from the advert's own words.
 *
 * What it produces is a flat list of requirements, each carrying the other ways
 * of saying it. Three things go into that list:
 *
 *   1. named technologies, from the stack dictionary;
 *   2. named concepts, from the equivalence table — accessibility, SSR,
 *      observability, design systems and the rest;
 *   3. whatever is left of the responsibility bullets that named neither.
 *
 * The third is the weakest and is capped, because a sentence matched word by
 * word is the kind of signal that scored paraphrase as absence in the first
 * place.
 */

const REQUIRED_HEADINGS =
  /\b(requirements?|must[- ]have|what you (?:bring|need)|qualifications?|we expect|your profile|about you|anforderungen)\b/i;
const PREFERRED_HEADINGS =
  /\b(nice[- ]to[- ]have|preferred|added bonus|bonus|a plus|desirable|would be great|optional|wünschenswert)\b/i;
const RESPONSIBILITY_HEADINGS =
  /\b(responsibilit(?:y|ies)|what you(?:'|’)?ll do|what you will do|your (?:role|tasks|mission)|the job|day[- ]to[- ]day|aufgaben)\b/i;

type LineKind = "required" | "preferred" | "responsibility" | "body";

type Line = { text: string; normalized: string; kind: LineKind };

/**
 * The advert, line by line, each one carrying the heading it sits under.
 *
 * The heading is the only place an advert says how much it means something. A
 * tool under "added bonus" and the same tool under "you must have" are the same
 * word and not the same requirement, and scoring them alike is what makes a
 * strong candidate lose a grade for never having used an optional dashboard.
 */
function readLines(text: string): Line[] {
  let kind: LineKind = "body";

  return text.split(/\r?\n/).map((raw) => {
    const line = raw.trim();
    if (line && line.length <= 120) {
      if (PREFERRED_HEADINGS.test(line)) kind = "preferred";
      else if (REQUIRED_HEADINGS.test(line)) kind = "required";
      else if (RESPONSIBILITY_HEADINGS.test(line)) kind = "responsibility";
    }
    return { text: line, normalized: normalize(line), kind };
  });
}

const BULLET = /^[-•*·–—▪]\s*|^\d+[.)]\s*/;
const stripBullet = (line: string) => line.replace(BULLET, "").trim();

/**
 * What each named concept is, and therefore which dimension it scores in.
 *
 * The line is between what a person knows how to do and what a person was
 * responsible for. Accessibility, CI/CD and state management are capabilities —
 * you either work that way or you do not — and they belong to Skills Match.
 * Application performance, reliability and developer experience are outcomes
 * somebody owned, which is a claim about the job they had rather than about a
 * technique they know, and they belong to Experience Relevance.
 */
const CONCEPT_CATEGORIES: Record<string, RequirementCategory> = {
  accessibility: "practice",
  observability: "practice",
  ssr: "practice",
  "technical seo": "practice",
  "core web vitals": "practice",
  "semantic html": "practice",
  "design system": "practice",
  "reusable components": "practice",
  "shared libraries": "practice",
  "component architecture": "practice",
  "state management": "practice",
  "responsive ui": "practice",
  "application performance": "responsibility",
  reliability: "responsibility",
  "developer experience": "responsibility",
  experimentation: "responsibility",
  "continuous improvement": "responsibility",
  testing: "practice",
  "ci/cd": "practice",
  agile: "practice",
  git: "tool",
  "customer-facing applications": "experience",
  "internal tools": "experience",
  fintech: "domain",
  "regulated industry": "domain",
  ownership: "soft_skill",
  collaboration: "soft_skill",
  graphql: "skill",
  "next.js": "skill",
  typescript: "skill",
  react: "skill",
};

/** Display names for the concepts, since the table's keys are lower case. */
const CONCEPT_NAMES: Record<string, string> = {
  ssr: "SSR",
  "ci/cd": "CI/CD",
  "technical seo": "Technical SEO",
  "core web vitals": "Core Web Vitals",
  "semantic html": "Semantic HTML",
  "responsive ui": "Responsive UI",
  "design system": "Design systems",
  "state management": "State management",
  "component architecture": "Component architecture",
  "customer-facing applications": "Customer-facing applications",
  "internal tools": "Internal tools",
  "application performance": "Application performance",
  "developer experience": "Developer experience",
  "continuous improvement": "Continuous improvement",
  "reusable components": "Reusable components",
  "shared libraries": "Shared libraries",
  "regulated industry": "Regulated industry",
  graphql: "GraphQL",
  "next.js": "Next.js",
  typescript: "TypeScript",
  react: "React",
  git: "Git",
};

const titleCase = (term: string) => term.charAt(0).toUpperCase() + term.slice(1);

const IMPORTANCE_OF: Record<LineKind, RequirementImportance> = {
  required: "required",
  preferred: "preferred",
  responsibility: "important",
  body: "important",
};

/** The strongest claim the advert makes about a term, wherever it makes it. */
function strongest(
  a: RequirementImportance | undefined,
  b: RequirementImportance,
): RequirementImportance {
  const rank: Record<RequirementImportance, number> = { required: 3, important: 2, preferred: 1 };
  if (!a) return b;
  return rank[a] >= rank[b] ? a : b;
}

type Draft = {
  name: string;
  category: RequirementCategory;
  importance: RequirementImportance;
  aliases: Set<string>;
  sourceText: string;
};

/**
 * Requirements, deduplicated as they are collected.
 *
 * An advert says "React" in the summary, "strong React experience" under About
 * You and "React and TypeScript" in a bullet. That is one requirement asked for
 * three times, not three requirements — counting it three times would weight
 * the advert's repetition rather than its meaning.
 */
class Drafts {
  private readonly byName = new Map<string, Draft>();

  /**
   * The key a requirement is already filed under, if it is.
   *
   * Names alone are not enough: the stack dictionary calls it "SSR / SSG" and
   * the equivalence table calls it "SSR", and they are one thing the advert
   * asked for once. Two drafts are the same requirement when either one's name
   * appears among the other's spellings.
   */
  private existingKeyFor(name: string, aliases: readonly string[]): string | null {
    const needle = name.toLowerCase();
    const spellings = new Set(aliases.map((alias) => alias.toLowerCase()));

    for (const [key, draft] of this.byName) {
      if (key === needle) return key;

      /**
       * Two drafts are the same requirement when one is called what the other
       * calls itself: "SSR / SSG" from the stack dictionary lists "ssr" among
       * its spellings, and the concept table calls the same thing "SSR".
       *
       * Deliberately not an overlap of any two spellings, and deliberately not
       * a substring test. Both are too loose by miles — "end-to-end" is an
       * alias of testing and of ownership, and "typescript" contains "ts" —
       * and either one merges requirements that have nothing to do with each
       * other, which then quietly moves them into the wrong dimension.
       */
      const theirs = [...draft.aliases].map((alias) => alias.toLowerCase());
      if (theirs.includes(needle)) return key;
      if (spellings.has(key)) return key;
    }

    return null;
  }

  add(input: {
    name: string;
    category: RequirementCategory;
    importance: RequirementImportance;
    aliases?: readonly string[];
    sourceText: string;
  }): void {
    const key = this.existingKeyFor(input.name, input.aliases ?? []) ?? input.name.toLowerCase();
    const existing = this.byName.get(key);

    if (!existing) {
      this.byName.set(key, {
        name: input.name,
        category: input.category,
        importance: input.importance,
        aliases: new Set(input.aliases ?? []),
        sourceText: input.sourceText,
      });
      return;
    }

    existing.importance = strongest(existing.importance, input.importance);

    // A named concept knows what kind of thing it is; a dictionary tag falls
    // back to "skill" because that is what most of the dictionary holds. When
    // the two meet, the concept's answer is the better one.
    if (input.category !== "skill") existing.category = input.category;

    existing.aliases.add(input.name);
    for (const alias of input.aliases ?? []) existing.aliases.add(alias);
    // A concept the advert names plainly beats a dictionary tag that happens to
    // spell it with a slash in it.
    if (input.name.length < existing.name.length && !input.name.includes("/")) {
      existing.name = input.name;
    }
    // The longer quotation is the one that explains the requirement better.
    if (input.sourceText.length > existing.sourceText.length) {
      existing.sourceText = input.sourceText;
    }
  }

  has(name: string, aliases: readonly string[] = []): boolean {
    return this.existingKeyFor(name, aliases) !== null;
  }

  list(): JobRequirement[] {
    return [...this.byName.values()].map((draft, index) => ({
      id: `req-${index}`,
      name: draft.name,
      category: draft.category,
      importance: draft.importance,
      aliases: [...draft.aliases],
      sourceText: draft.sourceText.slice(0, 300),
    }));
  }
}

/* -------------------------------------------------------------------------- */

function readRoleTitle(lines: Line[]): string {
  const labelled = lines.find((line) => /^(job title|position|role)\s*[:\-]/i.test(line.text));
  if (labelled) return labelled.text.split(/[:\-]/).slice(1).join(" ").trim().slice(0, 120);

  const first = lines.find((line) => line.text.length > 2);
  if (!first) return "";
  if (first.text.length > 90 || /[.!?]\s/.test(first.text)) return "";
  return first.text.replace(BULLET, "").trim().slice(0, 120);
}

const SENIORITY = /\b(intern|junior|mid[- ]level|senior|staff|principal|lead|head of|director)\b/i;

const DOMAINS = [
  "fintech",
  "healthtech",
  "e-commerce",
  "ecommerce",
  "gaming",
  "music",
  "saas",
  "b2b",
  "b2c",
  "edtech",
  "logistics",
  "travel",
  "adtech",
  "cybersecurity",
  "marketplace",
  "media",
  "banking",
  "insurance",
  "mobility",
  "energy",
  "retail",
  "artificial intelligence",
  "machine learning",
];

/**
 * Words that appear in every advert ever written and say nothing about this
 * one. Keyword coverage that counts these is measuring how much of a generic
 * advert a CV echoes, which is not a thing worth measuring.
 */
const GENERIC = new Set([
  "team",
  "teams",
  "work",
  "working",
  "experience",
  "customer",
  "customers",
  "company",
  "companies",
  "people",
  "role",
  "roles",
  "job",
  "position",
  "build",
  "building",
  "built",
  "ship",
  "shipping",
  "help",
  "helping",
  "join",
  "joining",
  "looking",
  "candidate",
  "candidates",
  "opportunity",
  "environment",
  "culture",
  "business",
  "product",
  "products",
  "project",
  "projects",
  "user",
  "users",
  "week",
  "day",
  "days",
  "year",
  "years",
  "part",
  "across",
  "every",
  "modern",
  "strong",
  "comfortable",
  "care",
  "cares",
  "own",
  "owns",
  "will",
  "we",
  "you",
  "your",
  "our",
  "us",
  "the",
  "and",
  "with",
  "for",
  "that",
  "this",
]);

/* -------------------------------------------------------------------------- */

/**
 * The advert, structured. Deterministic: the same text always reads the same
 * way, which is what lets the tests hold it in place.
 */
export function readJobDescription(text: string): JobAnalysis {
  const lines = readLines(text);
  const normalized = normalize(text);
  const drafts = new Drafts();

  /* 1. Named technologies ---------------------------------------------------- */
  for (const tag of detectStack(text)) {
    const spellings = TECHNOLOGIES[tag] ?? [];
    const terms = [tag, ...spellings];

    const mentions = lines.filter((line) =>
      terms.some((term) => containsTerm(line.normalized, term)),
    );
    const kinds = new Set(mentions.map((line) => line.kind));

    const importance: RequirementImportance =
      kinds.has("required") || (mentions.length > 1 && !kinds.has("preferred"))
        ? "required"
        : kinds.size === 1 && kinds.has("preferred")
          ? "preferred"
          : "important";

    drafts.add({
      name: tag,
      category: CONCEPT_CATEGORIES[tag.toLowerCase()] ?? "skill",
      importance,
      aliases: [...spellings, ...aliasesFor(tag)],
      sourceText: mentions[0]?.text ?? tag,
    });
  }

  /* 2. Named concepts -------------------------------------------------------- */
  for (const entry of EQUIVALENCES) {
    const terms = [entry.term, ...entry.aliases];
    const mentions = lines.filter((line) =>
      terms.some((term) => containsTerm(line.normalized, term)),
    );
    if (mentions.length === 0) continue;

    const name = CONCEPT_NAMES[entry.term] ?? titleCase(entry.term);
    const kinds = new Set(mentions.map((line) => line.kind));
    const importance: RequirementImportance = kinds.has("required")
      ? "required"
      : kinds.size === 1 && kinds.has("preferred")
        ? "preferred"
        : "important";

    drafts.add({
      name,
      category: CONCEPT_CATEGORIES[entry.term] ?? "practice",
      importance,
      aliases: entry.aliases,
      sourceText: mentions[0]!.text,
    });
  }

  /* 3. Whatever the bullets asked for that nothing above caught --------------- */
  const claimed = drafts.list();
  const covered = (line: Line) =>
    claimed.some((requirement) =>
      [requirement.name, ...requirement.aliases].some((term) =>
        containsTerm(line.normalized, term),
      ),
    );

  const leftovers = lines
    .filter(
      (line) =>
        BULLET.test(line.text) &&
        line.text.length >= 25 &&
        line.text.length <= 200 &&
        !covered(line),
    )
    .slice(0, 6);

  for (const line of leftovers) {
    const sentence = stripBullet(line.text);
    drafts.add({
      name: sentence.slice(0, 70),
      category: line.kind === "preferred" ? "domain" : "responsibility",
      importance: IMPORTANCE_OF[line.kind],
      aliases: keyPhrases(sentence),
      sourceText: sentence,
    });
  }

  const requirements = drafts.list();

  return {
    roleTitle: readRoleTitle(lines),
    requirements,
    keywords: readKeywords(text, requirements),
    inferredSeniority: text.match(SENIORITY)?.[0]?.toLowerCase() ?? "",
    domain: DOMAINS.find((domain) => containsTerm(normalized, domain)) ?? "",
  };
}

/** The words of a leftover bullet that carry it, as things to look for. */
function keyPhrases(sentence: string): string[] {
  return normalize(sentence)
    .split(" ")
    .map((word) => word.replace(/^[.\-]+|[.\-]+$/g, ""))
    .filter((word) => word.length >= 5 && !STOP_WORDS.has(word) && !GENERIC.has(word))
    .slice(0, 5);
}

/**
 * The terminology that makes this role this role.
 *
 * Not the advert's most frequent words: those are "build", "team" and "ship" in
 * every advert ever posted, and a CV that fails to say them has failed at
 * nothing. What is counted here is what is left after the generic vocabulary
 * and the requirements are taken out — the terms that are specific enough that
 * finding them in a CV means something.
 */
function readKeywords(text: string, requirements: readonly JobRequirement[]): JobKeyword[] {
  const counted = normalize(text);
  const occurrencesOf = (term: string) => {
    const needle = normalize(term).trim();
    if (!needle) return 1;
    return Math.max(1, counted.split(needle).length - 1);
  };

  /**
   * The advert's own word for each thing it asks for.
   *
   * This is what "job-specific terminology" means: what the advert asks for,
   * not the words it happens to repeat. "Team", "work" and "ship" appear in
   * every advert ever written, and a CV that fails to say them has failed at
   * nothing.
   *
   * The dimension shares its vocabulary with Skills Match and measures a
   * different property of the same document — the overlap section 32 permits
   * and asks to have written down. Skills Match asks whether the CV *evidences*
   * a thing where evidence counts; this asks only whether the terminology is
   * anywhere in the document at all. A CV that lists everything and shows
   * nothing scores well here and poorly there, which is the difference worth
   * being able to see.
   *
   * A term counts once however often it appears: repetition is the advert's
   * emphasis, never the CV's evidence.
   */
  const fromRequirements = requirements
    .filter((requirement) => requirement.name.length >= 3 && requirement.name.length <= 40)
    .map((requirement, position): JobKeyword => ({
      id: `kw-req-${position}`,
      text: requirement.name,
      weight: requirement.importance === "required" ? "primary" : "secondary",
      occurrences: occurrencesOf(requirement.name),
      aliases: requirement.aliases,
    }));

  const claimed = requirements.flatMap((requirement) =>
    [requirement.name, ...requirement.aliases].map((term) => term.toLowerCase()),
  );
  const isClaimed = (term: string) =>
    claimed.some((phrase) => phrase === term || phrase.includes(term));

  const counts = new Map<string, number>();

  for (const raw of counted.split(" ")) {
    const term = raw.replace(/^[.\-]+|[.\-]+$/g, "");
    if (term.length < 5) continue;
    if (STOP_WORDS.has(term) || GENERIC.has(term) || isClaimed(term)) continue;
    if (/^\d/.test(term)) continue;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }

  /**
   * What is left over after the requirements have taken their vocabulary: the
   * advert's remaining specific words. Only terms it repeats survive, because a
   * word said once in a sentence nobody was asked to answer is not a
   * requirement in disguise — it is prose.
   */
  const leftovers = [...counts.entries()]
    .filter(([, occurrences]) => occurrences >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([term, occurrences], position): JobKeyword => ({
      id: `kw-extra-${position}`,
      text: term,
      weight: occurrences >= 3 ? "primary" : "secondary",
      occurrences,
    }));

  const keywords = [...fromRequirements, ...leftovers];

  /**
   * Fewer than a handful of distinctive terms is not a small measurement, it is
   * no measurement: one word either present or absent would swing the dimension
   * by a third. Section 64 asks for that decision to be explicit — the
   * dimension reports as unmeasurable and its weight is redistributed.
   */
  return keywords.length >= MIN_KEYWORDS ? keywords : [];
}

/** Below this many distinctive terms, keyword coverage says nothing. */
const MIN_KEYWORDS = 4;

/** Whether there is enough advert to read. */
export function hasJobContent(text: string): boolean {
  return text.replace(/\s+/g, "").length >= 120;
}
