/**
 * The CV workspace is still being shaped. Keep it available while developing,
 * but remove every product entry point from production until it is ready.
 */
export const CV_ANALYSIS_ENABLED = process.env.NODE_ENV !== "production";

/** A single message keeps disabled CV entry points consistent. */
export const CV_ANALYSIS_UNAVAILABLE = "The CV workspace is not available.";
