import { RELIABLE_SAMPLE, type RateRow } from "@/server/db/queries/analytics";

const pct = (value: number) => `${Math.round(value * 100)}%`;

/**
 * A ranked table, with the bar drawn inside it rather than beside it.
 *
 * One measure, one hue — the stamp violet. A categorical palette would be wrong
 * here (there are no categories to tell apart, only magnitudes) and would put a
 * second loud element next to the stamp, which the product's identity does not
 * allow.
 *
 * The count travels with every row and rows below a reliable sample are dimmed
 * rather than hidden: one application answered once is 100%, and a table that
 * hides the denominator invites exactly that misreading.
 */
export function RateTable({
  caption,
  unit,
  rows,
}: {
  caption: string;
  unit: string;
  rows: readonly RateRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="eyebrow text-muted">{caption}</h3>
        <p className="rounded-[3px] border border-dashed border-rule bg-card p-4 font-mono text-xs text-faint">
          Nothing to measure yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="eyebrow text-muted">{caption}</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            {caption}. Response rate and number of applications per {unit}.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="w-px border-b-[1.5px] border-ink py-2 pr-4 text-left font-mono text-[10px] tracking-[0.14em] text-muted uppercase"
              >
                {unit}
              </th>
              <th
                scope="col"
                className="border-b-[1.5px] border-ink py-2 text-left font-mono text-[10px] tracking-[0.14em] text-muted uppercase"
              >
                Response rate
              </th>
              <th
                scope="col"
                className="border-b-[1.5px] border-ink py-2 pl-3 text-right font-mono text-[10px] tracking-[0.14em] text-muted uppercase"
              >
                Replied / sent
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const thin = row.total < RELIABLE_SAMPLE;
              return (
                <tr key={row.label} className={thin ? "opacity-55" : undefined}>
                  <td className="w-px border-b border-rule py-2.5 pr-4 whitespace-nowrap">
                    {row.label}
                  </td>
                  <td className="border-b border-rule py-2.5">
                    <span className="flex items-center gap-2.5">
                      {/* Track and fill: the track gives the eye the 100% reference. */}
                      <span
                        aria-hidden="true"
                        className="h-2 min-w-[80px] flex-1 overflow-hidden rounded-[2px] bg-stamp-wash"
                      >
                        <span
                          className="block h-full rounded-[2px] bg-stamp"
                          style={{ width: `${Math.max(row.rate * 100, row.rate > 0 ? 3 : 0)}%` }}
                        />
                      </span>
                      <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums">
                        {pct(row.rate)}
                      </span>
                    </span>
                  </td>
                  <td className="border-b border-rule py-2.5 pl-3 text-right font-mono text-xs text-muted tabular-nums">
                    {row.responded}/{row.total}
                    {thin && <span className="ml-1.5 text-faint">thin</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-[11px] text-faint">
        Rows marked <span className="text-muted">thin</span> have fewer than {RELIABLE_SAMPLE}{" "}
        applications — read them as anecdote, not rate.
      </p>
    </div>
  );
}
