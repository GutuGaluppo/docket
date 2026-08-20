/**
 * One drawing per step of "how it works".
 *
 * Line art rather than screenshots: a step is a claim about what happens, and a
 * capture of the real interface is already made two sections down, where the
 * page says so. These are diagrams — a browser handing a link to a form, an ad
 * turning into tags, a sheet taking the stamp — drawn in the same ink and rule
 * weights as the app so the page reads as one object.
 *
 * Everything is `currentColor` over Tailwind colour classes, so both themes are
 * served by one file and no asset has to be shipped or lazily loaded.
 */
export type Step = "link" | "tags" | "stamp";

const SHEET = "text-rule";
const INK = "text-stamp";

export function StepArt({ step }: { step: Step }) {
  return (
    <svg
      viewBox="0 0 64 44"
      fill="none"
      aria-hidden="true"
      className="mb-1 h-14 w-20 shrink-0"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {step === "link" && (
        <>
          {/* the tab already open */}
          <rect
            x="1"
            y="5"
            width="30"
            height="24"
            rx="2"
            className={SHEET}
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line
            x1="1"
            y1="12"
            x2="31"
            y2="12"
            className={SHEET}
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect x="5" y="16.5" width="19" height="3" rx="1.5" className={INK} fill="currentColor" />
          <line
            x1="5"
            y1="24"
            x2="22"
            y2="24"
            className={SHEET}
            stroke="currentColor"
            strokeWidth="1.5"
          />
          {/* handed over */}
          <path d="M36 17h8m-3-3 3 3-3 3" className={INK} stroke="currentColor" strokeWidth="1.5" />
          {/* into the form */}
          <rect
            x="49"
            y="5"
            width="14"
            height="24"
            rx="2"
            className={SHEET}
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line
            x1="52"
            y1="12"
            x2="60"
            y2="12"
            className={INK}
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line
            x1="52"
            y1="17"
            x2="60"
            y2="17"
            className={INK}
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line
            x1="52"
            y1="22"
            x2="57"
            y2="22"
            className={SHEET}
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </>
      )}

      {step === "tags" && (
        <>
          <rect
            x="1"
            y="4"
            width="26"
            height="26"
            rx="2"
            className={SHEET}
            stroke="currentColor"
            strokeWidth="1.5"
          />
          {[10, 15, 20, 25].map((y, index) => (
            <line
              key={y}
              x1="5"
              y1={y}
              x2={index % 2 === 0 ? 23 : 18}
              y2={y}
              className={SHEET}
              stroke="currentColor"
              strokeWidth="1.5"
            />
          ))}
          <path d="M32 17h6m-2-3 2 3-2 3" className={INK} stroke="currentColor" strokeWidth="1.5" />
          {/* what the ad became */}
          <rect x="43" y="6" width="20" height="8" rx="4" className={INK} fill="currentColor" />
          <rect
            x="43"
            y="18"
            width="14"
            height="8"
            rx="4"
            className={INK}
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="43"
            y="30"
            width="17"
            height="8"
            rx="4"
            className={SHEET}
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </>
      )}

      {step === "stamp" && (
        <>
          <rect
            x="1"
            y="4"
            width="34"
            height="30"
            rx="2"
            className={SHEET}
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line
            x1="6"
            y1="11"
            x2="24"
            y2="11"
            className={SHEET}
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line
            x1="6"
            y1="17"
            x2="19"
            y2="17"
            className={SHEET}
            stroke="currentColor"
            strokeWidth="1.5"
          />
          {/* the stamp itself, landing at an angle */}
          <g transform="rotate(-6 46 22)">
            <rect
              x="30"
              y="12"
              width="32"
              height="20"
              rx="2"
              className={INK}
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <line
              x1="34"
              y1="19"
              x2="58"
              y2="19"
              className={INK}
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <line
              x1="34"
              y1="25"
              x2="48"
              y2="25"
              className={INK}
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </g>
        </>
      )}
    </svg>
  );
}
