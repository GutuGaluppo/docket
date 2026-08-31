"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

import { atlasName, locate } from "@/lib/geo/coordinates";
import { protocolNumber } from "@/lib/format";
import type { Place } from "@/server/db/queries/analytics";

/**
 * The register, drawn as places.
 *
 * A table of countries answers "how many in Germany". It does not answer the
 * question anyone actually has, which is "where have I been aiming" — and that
 * one is a shape, not a number. Three months of applications on a map says in a
 * glance what twelve rows of percentages take a minute to add up: everything is
 * within two hours of home, or everything is in one time zone that is eight
 * hours away, or the four replies all came from the same city.
 *
 * Clicking a pin lists what is behind it. That is the point of the pin — a dot
 * whose only content is its own size is decoration.
 *
 * The topology is served from this origin rather than a CDN. It is 105KB fetched
 * once, and it means the map still draws with no network to anyone else and
 * tells nobody outside this machine which countries are being looked at.
 */
const TOPOLOGY = "/geo/countries-110m.json";

/** Pin area grows with the count, so ten entries do not read as ten times one. */
function radius(count: number): number {
  return 3.5 + Math.sqrt(count) * 2.2;
}

type Placed = Place & {
  key: string;
  point: readonly [number, number];
  precision: "city" | "country";
};

export function ApplicationsMap({ places }: { places: readonly Place[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  /**
   * Only the places that can be drawn. "Remote — Europe" is a real thing to
   * have applied to and not a point on a map, so it is counted separately and
   * said in words below the map rather than pinned to the middle of the ocean.
   */
  const { pins, unplaceable } = useMemo(() => {
    const drawn: Placed[] = [];
    let missed = 0;

    for (const place of places) {
      const located = locate(place.city, place.country);
      if (!located) {
        missed += place.entries.length;
        continue;
      }
      drawn.push({
        ...place,
        key: `${place.city ?? ""}|${place.country}`,
        point: located.point,
        precision: located.precision,
      });
    }

    // Biggest first in the data, smallest first on the page: a small pin drawn
    // under a large one is a pin nobody can click.
    return { pins: drawn.sort((a, b) => b.entries.length - a.entries.length), unplaceable: missed };
  }, [places]);

  const withEntries = useMemo(() => new Set(pins.map((pin) => atlasName(pin.country))), [pins]);

  const current = pins.find((pin) => pin.key === selected) ?? null;
  const label = (place: Placed) => (place.city ? `${place.city}, ${place.country}` : place.country);

  if (pins.length === 0) {
    return (
      <p className="text-sm text-muted">
        No entry names a city or a country yet. Add one to an entry and it appears here.
      </p>
    );
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="map-panel">
        <ComposableMap
          className="map-canvas"
          projection="geoEqualEarth"
          projectionConfig={{ scale: 165 }}
          width={880}
          height={420}
          // The poles hold no jobs and a great deal of empty pixels.
          viewBox="0 30 880 360"
        >
          <Geographies geography={TOPOLOGY}>
            {({
              geographies,
            }: {
              geographies: Array<{ rsmKey: string; properties: { name: string } }>;
            }) =>
              geographies.map((geography) => (
                <Geography
                  key={geography.rsmKey}
                  geography={geography}
                  className="map-land"
                  data-active={withEntries.has(geography.properties.name) ? "true" : undefined}
                  tabIndex={-1}
                />
              ))
            }
          </Geographies>

          {pins.map((pin) => {
            const chosen = pin.key === selected;
            return (
              <Marker
                key={pin.key}
                coordinates={pin.point as [number, number]}
                className="map-pin"
                data-selected={chosen ? "true" : undefined}
                onClick={() => setSelected(chosen ? null : pin.key)}
                role="button"
                tabIndex={0}
                aria-label={`${label(pin)} — ${pin.entries.length} application${
                  pin.entries.length === 1 ? "" : "s"
                }`}
                onKeyDown={(event: React.KeyboardEvent) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(chosen ? null : pin.key);
                  }
                }}
              >
                {chosen && <circle className="map-ping" r={radius(pin.entries.length)} />}
                <circle r={radius(pin.entries.length)} />
                <title>
                  {label(pin)} — {pin.entries.length}
                </title>
              </Marker>
            );
          })}
        </ComposableMap>

        <p className="map-legend">
          <span>{pins.length} places</span>
          <span>Pin size is the number of applications</span>
          {unplaceable > 0 && <span>{unplaceable} remote, not on the map</span>}
        </p>
      </div>

      <aside className="panel panel-pad" aria-live="polite">
        {current ? (
          <>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="text-md font-bold tracking-[-0.01em]">{label(current)}</h3>
              <button
                type="button"
                className="link-quiet"
                onClick={() => setSelected(null)}
                suppressHydrationWarning
              >
                Clear
              </button>
            </div>
            {current.precision === "country" && (
              <p className="mb-3 text-xs text-faint">
                Placed at the centre of the country — the register does not know where{" "}
                {current.city ?? "this one"} is.
              </p>
            )}
            <ul className="map-list">
              {current.entries.map((entry, index) => (
                <li key={entry.id}>
                  <Link
                    href={`/applications/${entry.id}`}
                    style={{ "--rise-delay": `${index * 35}ms` } as React.CSSProperties}
                  >
                    <span className="min-w-0">
                      <b className="block truncate text-sm font-semibold">{entry.company}</b>
                      <span className="block truncate text-xs text-muted">{entry.position}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-[10px] text-faint">
                        {protocolNumber(entry.protocolNumber)}
                      </span>
                      <span
                        className={`block font-mono text-[10px] ${
                          entry.rejected ? "text-flag" : "text-stamp"
                        }`}
                      >
                        {entry.rejected ? "filed" : (entry.stage ?? "in play")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h3 className="eyebrow mb-3 text-muted">Where they went</h3>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              Click a pin to read the applications behind it.
            </p>
            <ul className="map-list">
              {pins.slice(0, 6).map((pin, index) => (
                <li key={pin.key}>
                  <button
                    type="button"
                    className="w-full cursor-pointer text-left"
                    onClick={() => setSelected(pin.key)}
                    suppressHydrationWarning
                    style={{ "--rise-delay": `${index * 35}ms` } as React.CSSProperties}
                  >
                    <span className="flex items-baseline justify-between gap-3 rounded-lg border border-rule bg-sheet px-3 py-2.5 transition-colors hover:border-stamp">
                      <span className="truncate text-sm">{label(pin)}</span>
                      <span className="font-mono text-xs text-muted">{pin.entries.length}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}
