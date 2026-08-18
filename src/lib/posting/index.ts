export { adapterFor, BOARD_ADAPTERS, isBoardHost, type BoardAdapter } from "./adapters";
export { draftFromPage, hostBrand, splitTitle } from "./heuristics";
export {
  decodeEntities,
  documentTitle,
  firstHeading,
  jsonLdBlocks,
  metaContent,
  stripTags,
} from "./html";
export { draftFromJsonLd, draftFromPosting, findJobPostings } from "./jsonld";
export { splitLocation } from "./location";
export { mergeDraft, type Contribution } from "./merge";
export { isBlockedAddress } from "./net";
export { blockedHost, hostMatches, inspectPostingUrl, type UrlVerdict } from "./url";
export {
  EMPTY_VALUES,
  POSTING_FIELDS,
  type PostingDraft,
  type PostingFailure,
  type PostingField,
  type PostingPartial,
  type PostingResult,
  type PostingSource,
} from "./types";
