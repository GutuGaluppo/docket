import { version } from "../../package.json";

/**
 * The edition of the register on show.
 *
 * `package.json` is the single source, so the number cannot drift from the one
 * the tooling reports — `pnpm version minor` moves both at once, and there is no
 * second constant to forget. It is bumped by hand, on purpose: it marks a
 * release someone decided was worth marking, which is a judgement no commit
 * count can make.
 */
export const APP_VERSION = version;

/**
 * Which build is actually serving, when the platform says so.
 *
 * A version answers "what was released"; it cannot answer "is my fix live yet",
 * because the number only moves when a human moves it. Vercel exposes the commit
 * behind the running deployment, and seven characters of it are enough to settle
 * that question without leaving the page. Empty in local development, where the
 * answer is always "whatever you just built".
 */
export const BUILD_REF = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "";
