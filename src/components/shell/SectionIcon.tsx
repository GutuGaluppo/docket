/**
 * One mark per section of the sidebar.
 *
 * Drawn rather than imported: seven 16px glyphs are smaller than any icon
 * package's entry point, they inherit `currentColor` so the active and resting
 * states cost nothing extra, and they can be kept in the same line weight as the
 * rules and borders the rest of the interface is drawn with.
 */
export type IconName =
  | "docket"
  | "board"
  | "calendar"
  | "archive"
  | "analytics"
  | "import"
  | "settings"
  | "plus"
  | "menu"
  | "rail";

const PATHS: Record<IconName, React.ReactNode> = {
  docket: (
    <>
      <rect x="2.75" y="2" width="10.5" height="12" rx="1.5" />
      <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
    </>
  ),
  board: (
    <>
      <rect x="2" y="3" width="3.4" height="10" rx="1" />
      <rect x="6.3" y="3" width="3.4" height="7" rx="1" />
      <rect x="10.6" y="3" width="3.4" height="9" rx="1" />
    </>
  ),
  calendar: (
    <>
      <rect x="2" y="3.2" width="12" height="10.8" rx="1.5" />
      <path d="M2 6.4h12M5.4 2v2.4M10.6 2v2.4M5.2 9.6h1.4" />
    </>
  ),
  archive: (
    <>
      <rect x="2" y="2.8" width="12" height="3.2" rx="1" />
      <path d="M3.2 6.2v6.1a1.4 1.4 0 0 0 1.4 1.4h6.8a1.4 1.4 0 0 0 1.4-1.4V6.2M6.4 9.2h3.2" />
    </>
  ),
  analytics: (
    <>
      <path d="M2.5 13.4h11" />
      <path d="M4.9 13.4V9.2M8 13.4V5.4M11.1 13.4v-2.8" />
    </>
  ),
  import: (
    <>
      <path d="M8 2.4v7.2m0 0 2.6-2.6M8 9.6 5.4 7" />
      <path d="M2.9 11v1.4A1.6 1.6 0 0 0 4.5 14h7a1.6 1.6 0 0 0 1.6-1.6V11" />
    </>
  ),
  settings: (
    <>
      <path d="M2.5 5.2h11M2.5 10.8h11" />
      <circle cx="6" cy="5.2" r="1.7" />
      <circle cx="10" cy="10.8" r="1.7" />
    </>
  ),
  plus: <path d="M8 3.4v9.2M3.4 8h9.2" />,
  menu: <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />,
  rail: (
    <>
      <rect x="2" y="2.8" width="12" height="10.4" rx="1.5" />
      <path d="M6.4 2.8v10.4" />
    </>
  ),
};

export function SectionIcon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}
