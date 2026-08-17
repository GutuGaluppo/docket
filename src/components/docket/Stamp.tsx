import { formatStamp } from "@/lib/format";

/**
 * The signature element. Rendered on the server from the timezone captured at
 * stamping time, so there is nothing to hydrate and nothing to flash.
 */
export function Stamp({
  at,
  timezone,
  className = "",
}: {
  at: Date;
  timezone?: string | null;
  className?: string;
}) {
  const { date, time } = formatStamp(at, timezone);
  return (
    <time className={`stamp ${className}`} dateTime={at.toISOString()}>
      <span className="stamp-date">{date}</span>
      <span className="stamp-time">{time}</span>
    </time>
  );
}
