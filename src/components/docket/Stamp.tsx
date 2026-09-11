import { formatStamp } from "@/lib/format";

/**
 * The signature element: a round rubber stamp, inked once and never cleaned.
 *
 * Everything except the date, the time and the stage name is fixed geometry, so
 * the whole thing renders on the server from the timezone captured at stamping
 * time — there is nothing to hydrate and nothing to flash.
 *
 * The wear is a vector mask rather than a raster texture or `feTurbulence`. It
 * scales, weighs nothing, and lands on the same pixels in every browser, which
 * matters because the same stamp is drawn twenty times on a register page.
 */

/**
 * Both masks are identical for every stamp on the page, so they are declared
 * once by `StampDefs` in the root layout and referenced by id from here. That
 * keeps a register of twenty rows from repeating forty mask shapes, and avoids
 * `useId`, which a server component cannot call.
 */
const DISTRESS = "docket-stamp-wear";
const BANNER_CUT = "docket-stamp-banner";

/**
 * Below this the three-row layout stops being readable: at 104px the date is
 * rendered at nine pixels and the time below it at seven. The compact variant
 * spends that budget on fewer rows instead.
 */
const COMPACT_BELOW = 140;

/* The fallback goes inside `var()`: a presentation attribute whose custom
   property is missing is invalid as a whole, taking the rest of the stack with
   it, so the chain after the comma would never be reached. */
const MONO = "var(--font-mono, ui-monospace), SFMono-Regular, Menlo, monospace";
const CONDENSED = "'Arial Narrow', 'Roboto Condensed', Impact, sans-serif";

/**
 * Every run of text is drawn to a width this component computes rather than to
 * whatever width the resolved font happens to produce. A condensed face is a
 * request, not a guarantee — `Arial Narrow` is absent on most Linux machines
 * and the substitute is wide enough to push a long stage name through the side
 * of the banner. `textLength` makes the fit a property of the geometry instead.
 */
function fit(text: string, fontSize: number, em: number, max: number) {
  return Math.round(Math.min(max, text.length * fontSize * em) * 100) / 100;
}

/**
 * The banner runs wider than the circle and overhangs it on both sides, as a
 * real rubber stamp does: the ring is the seal and the banner is the word
 * pressed across it. That overhang is what makes the stage name the loudest
 * thing in the mark, and it costs the ring some radius to buy the width inside
 * a 300-unit box — the banner is 1.24 times the circle's diameter.
 */
const RING_OUTER = 112;
const RING_INNER = 101;
const BANNER = { x: 10, y: 119, width: 280, height: 62, stroke: 6 } as const;

/** Usable width inside the banner, allowing for its stroke and a little air. */
const BANNER_WIDTH = 250;

/**
 * The banner splits the circle into two wells, and each holds one line. Both
 * baselines sit eleven units off the banner rather than centred in their well,
 * because the ring closes in towards the crown and the foot: a ten-glyph date
 * needs 150 units of width, and the inner ring clears only 133 at the middle of
 * the lower well against 158 here.
 */
const TOP_SLOT = 105;
const BOTTOM_SLOT = 213;

/** The star triplet, at whatever height and scale the layout has room for. */
function Stars({ y, scale = 0.78 }: { y: number; scale?: number }) {
  const star = "M0-12 3.2-3.8 12-3.6 5 1.7 7.3 10 0 5.2-7.3 10-5 1.7-12-3.6-3.2-3.8Z";
  return (
    <g transform={`translate(150 ${y}) scale(${scale})`} fill="currentColor">
      <path d={star} />
      <path transform="translate(-39 1) scale(.62)" d={star} />
      <path transform="translate(39 1) scale(.62)" d={star} />
    </g>
  );
}

/**
 * The stage name, set to the width of the banner rather than to a fixed size.
 * A long stage breaks onto two lines at the most even word boundary, so a name
 * like "Waiting on the hiring manager" stays upright instead of being squeezed
 * into one line.
 */
function statusLayout(label: string) {
  const text = label.toUpperCase().trim();

  if (text.length <= 8) return { lines: [text], fontSize: 40 };
  if (text.length <= 14) return { lines: [text], fontSize: 34 };
  if (text.length <= 20) return { lines: [text], fontSize: 28 };

  const words = text.split(/\s+/);
  let splitIndex = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (diff < bestDiff) {
      bestDiff = diff;
      splitIndex = i;
    }
  }

  return {
    lines: [words.slice(0, splitIndex).join(" "), words.slice(splitIndex).join(" ")],
    fontSize: 23,
  };
}

export function Stamp({
  at,
  timezone,
  status,
  rejected = false,
  size = 168,
  className = "",
}: {
  at: Date;
  timezone?: string | null;
  /** The board stage the entry had reached. Falls back to the neutral record. */
  status?: string | null;
  /** A filed rejection: the mark is pressed in red and reads "Rejected". */
  rejected?: boolean;
  size?: number;
  className?: string;
}) {
  const { date, time } = formatStamp(at, timezone);
  const label = rejected ? "Rejected" : (status ?? "").trim() || "Stamped";
  const compact = size < COMPACT_BELOW;
  const banner = statusLayout(label);

  return (
    <time
      className={`stamp${rejected ? " stamp--rejected" : ""} ${className}`}
      dateTime={at.toISOString()}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 300 300"
        width={size}
        height={size}
        role="img"
        aria-label={`${label} — ${date} ${time}`}
      >
        <g transform="rotate(-5 150 150)" mask={`url(#${DISTRESS})`}>
          {/* The rings are cut where the banner crosses them, so the banner
              needs no opaque fill of its own and the paper behind the stamp —
              a row, a hovered row, a dark theme — shows through unchanged. */}
          <g mask={`url(#${BANNER_CUT})`} fill="none" stroke="currentColor">
            <circle cx="150" cy="150" r={RING_OUTER} strokeWidth="6" />
            <circle cx="150" cy="150" r={RING_INNER} strokeWidth="2.2" />
          </g>

          {/* Four rivets in the channel between the rings. */}
          <g fill="currentColor">
            <circle cx="57.9" cy="98.1" r="3.6" />
            <circle cx="242.1" cy="98.1" r="3.6" />
            <circle cx="57.9" cy="201.9" r="3.6" />
            <circle cx="242.1" cy="201.9" r="3.6" />
          </g>

          <rect
            x={BANNER.x}
            y={BANNER.y}
            width={BANNER.width}
            height={BANNER.height}
            rx="9"
            fill="none"
            stroke="currentColor"
            strokeWidth={BANNER.stroke}
          />

          {/* The upper well holds the clock, and the stars stand in for it when
              there is no room to print one. Either way the well opposite the
              date is filled, so the mark never reads as lopsided. */}
          {compact ? (
            <Stars y={96} />
          ) : (
            <text
              x="150"
              y={TOP_SLOT}
              textAnchor="middle"
              fill="currentColor"
              fontFamily={MONO}
              fontSize="25"
              fontWeight="650"
              textLength={fit(time, 25, 0.78, 130)}
              lengthAdjust="spacingAndGlyphs"
            >
              {time}
            </text>
          )}

          <g
            fill="currentColor"
            fontFamily={CONDENSED}
            fontWeight="900"
            textAnchor="middle"
            fontSize={banner.fontSize}
            lengthAdjust="spacingAndGlyphs"
          >
            {banner.lines.map((line, index) => (
              <text
                key={`${index}-${line}`}
                x="150"
                // Optically centred on the banner: a cap-height run sits half a
                // cap above its own baseline, and a second line adds a step.
                y={(banner.lines.length === 1 ? 150 + banner.fontSize * 0.35 : 145) + index * 25}
                textLength={fit(line, banner.fontSize, 0.56, BANNER_WIDTH)}
              >
                {line}
              </text>
            ))}
          </g>

          {/* The date is the one line the stamp never gives up, so it takes the
              lower well at every size. It sits high in that well rather than
              centred in it: the ring closes in towards the foot of the circle
              and would clip the outer digits. */}
          <text
            x="150"
            y={BOTTOM_SLOT}
            textAnchor="middle"
            fill="currentColor"
            fontFamily={MONO}
            fontSize="25"
            fontWeight="650"
            textLength={fit(date, 25, 0.64, 150)}
            lengthAdjust="spacingAndGlyphs"
          >
            {date}
          </text>
        </g>
      </svg>
    </time>
  );
}

/**
 * The two masks every stamp shares, rendered once per document. Kept out of the
 * accessibility tree and out of the layout: it draws nothing by itself.
 */
export function StampDefs() {
  return (
    <svg width="0" height="0" aria-hidden focusable="false" className="absolute">
      <defs>
        <mask id={DISTRESS} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="300">
          <rect width="300" height="300" fill="white" />

          {/* Wear follows the shape it wears away, so the marks that ride the
              ring are drawn once and scaled to whatever radius the ring has —
              0.889 = 112/126, the radius this geometry took to buy the banner
              its overhang. The streaks across the banner are scaled separately,
              outward in x and inward in y, to track the wider, shallower band. */}
          <g transform="translate(150 150) scale(.889) translate(-150 -150)">
            <g fill="black" opacity=".92">
              <circle cx="55" cy="45" r="2.7" />
              <circle cx="79" cy="38" r="1.2" />
              <circle cx="112" cy="29" r="2.2" />
              <circle cx="138" cy="33" r="1.4" />
              <circle cx="188" cy="31" r="2.6" />
              <circle cx="222" cy="48" r="1.6" />
              <circle cx="255" cy="72" r="2.4" />

              <circle cx="34" cy="128" r="1.7" />
              <circle cx="48" cy="164" r="2.6" />
              <circle cx="34" cy="216" r="1.3" />
              <circle cx="63" cy="251" r="2.5" />
              <circle cx="114" cy="270" r="1.7" />
              <circle cx="160" cy="274" r="2.2" />
              <circle cx="215" cy="259" r="2.7" />
              <circle cx="257" cy="229" r="1.5" />
              <circle cx="270" cy="181" r="2.4" />
              <circle cx="271" cy="131" r="1.4" />
            </g>

            <g stroke="black" strokeLinecap="round" opacity=".9">
              <path d="M28 87 45 83" strokeWidth="3.2" />
              <path d="M70 25 91 29" strokeWidth="2.7" />
              <path d="M208 41 229 47" strokeWidth="2.2" />
              <path d="M258 100 270 112" strokeWidth="2.8" />
              <path d="M247 246 258 232" strokeWidth="3.1" />
              <path d="M162 268 182 266" strokeWidth="2.5" />
              <path d="M36 204 48 197" strokeWidth="2.3" />
            </g>
          </g>

          <g
            transform="translate(150 150) scale(1.094 .861) translate(-150 -150)"
            fill="black"
            opacity=".92"
          >
            <rect x="85" y="122" width="18" height="3.6" rx="1.8" transform="rotate(-7 85 122)" />
            <rect x="178" y="130" width="22" height="3.4" rx="1.7" transform="rotate(6 178 130)" />
            <rect x="52" y="179" width="28" height="3" rx="1.5" transform="rotate(-4 52 179)" />
            <rect x="210" y="171" width="18" height="3.2" rx="1.6" transform="rotate(8 210 171)" />
            <rect x="126" y="183" width="20" height="2.5" rx="1.25" />
            <rect x="26" y="140" width="16" height="3" rx="1.5" transform="rotate(-5 26 140)" />
            <rect x="252" y="158" width="20" height="2.8" rx="1.4" transform="rotate(4 252 158)" />
          </g>
        </mask>

        {/* The banner's outer stroke edge, to the unit: the rings stop exactly
            where the banner border starts, leaving no seam and no overlap. */}
        <mask id={BANNER_CUT} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="300">
          <rect width="300" height="300" fill="white" />
          <rect x="7" y="116" width="286" height="68" rx="12" fill="black" />
        </mask>
      </defs>
    </svg>
  );
}
