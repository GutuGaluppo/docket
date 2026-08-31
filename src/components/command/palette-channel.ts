/**
 * The one way anything outside the palette asks for the palette.
 *
 * A browser event rather than a React context: the search button lives in the
 * shell and the palette is mounted beside the shell, so there is no common
 * provider to hang state on that would not mean re-rendering every page on
 * every keystroke typed into it. An event crosses that gap without either side
 * importing the other's state.
 */
export const COMMAND_PALETTE_EVENT = "docket:command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT));
}
