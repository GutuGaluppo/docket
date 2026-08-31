"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
  type ZoomableGroupProps,
} from "react-simple-maps";

import { atlasName, locate } from "@/lib/geo/coordinates";
import {
  claimsGesture,
  focusOn,
  isWorld,
  MAX_ZOOM,
  MIN_ZOOM,
  wasDrag,
  WORLD,
  zoomBy,
  ZOOM_STEP,
  type View,
} from "@/lib/geo/view";
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

const WIDTH = 880;
const HEIGHT = 440;

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
   * Two pieces of zoom state, and they are not the same thing.
   *
   * `view` is what the map is *told*. It changes when a button is pressed and
   * when a gesture finishes — never while one is in progress, because
   * `ZoomableGroup` applies its `center`/`zoom` props by driving the d3 zoom
   * behaviour, and doing that mid-drag would fight the hand holding the map.
   *
   * `scale` is what the map currently *is*, updated on every frame of a
   * gesture. Nothing but the pins reads it: they divide their radius by it so a
   * dot stays a dot at fourteen times in, instead of swallowing the country
   * it is standing on.
   */
  const [view, setView] = useState<View>(WORLD);
  const [scale, setScale] = useState(1);

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

  /** Where the pointer went down, so a pan is not mistaken for a click. */
  const press = useRef<{ x: number; y: number } | null>(null);

  function goTo(pin: Placed) {
    setSelected(pin.key);
    setView((current) => focusOn(current, pin.point));
  }

  const onMove = useCallback((position: { zoom: number }) => setScale(position.zoom), []);

  const onMoveEnd = useCallback((position: { coordinates: [number, number]; zoom: number }) => {
    setView({ coordinates: position.coordinates, zoom: position.zoom });
    setScale(position.zoom);
  }, []);

  /**
   * The land, memoised into a stable element.
   *
   * A zoom gesture re-renders this component on every frame to keep the pins
   * sized. Without this the 177 country paths would be rebuilt on every one of
   * those frames for a set of props that never changes.
   */
  const land = useMemo(
    () => (
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
    ),
    [withEntries],
  );

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
      <div
        className="map-panel"
        onPointerDownCapture={(event) => {
          press.current = { x: event.clientX, y: event.clientY };
        }}
      >
        <div className="map-controls">
          <button
            type="button"
            className="map-control"
            onClick={() => setView((current) => zoomBy(current, ZOOM_STEP))}
            disabled={view.zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            suppressHydrationWarning
          >
            <Glyph d="M8 4.2v7.6M4.2 8h7.6" />
          </button>
          <button
            type="button"
            className="map-control"
            onClick={() => setView((current) => zoomBy(current, 1 / ZOOM_STEP))}
            disabled={view.zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            suppressHydrationWarning
          >
            <Glyph d="M4.2 8h7.6" />
          </button>
          <button
            type="button"
            className="map-control"
            onClick={() => setView(WORLD)}
            disabled={isWorld(view)}
            aria-label="Show the whole world again"
            title="Reset the view"
            suppressHydrationWarning
          >
            <Glyph d="M6 2.6H2.6V6M10 2.6h3.4V6M6 13.4H2.6V10M10 13.4h3.4V10" />
          </button>
        </div>

        <ComposableMap
          className="map-canvas"
          projection="geoEqualEarth"
          projectionConfig={{ scale: 165 }}
          width={WIDTH}
          height={HEIGHT}
        >
          <ZoomableGroup
            // Copied rather than passed through: the view's pair is readonly,
            // and the library's prop is not. The effect inside it depends on the
            // two numbers, not on the array, so a fresh one costs nothing.
            center={[view.coordinates[0], view.coordinates[1]]}
            zoom={view.zoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            // Panning stops at the edges of the projection. Without this the
            // world can be dragged off screen entirely, and the only way back
            // is a button the person has just scrolled away from.
            translateExtent={[
              [0, 0],
              [WIDTH, HEIGHT],
            ]}
            filterZoomEvent={GESTURE_FILTER}
            onMove={onMove}
            onMoveEnd={onMoveEnd}
          >
            {land}

            {pins.map((pin) => {
              const chosen = pin.key === selected;
              // Divided by the live scale so a pin keeps its size on screen
              // while the country under it grows.
              const r = radius(pin.entries.length) / scale;
              return (
                <Marker
                  key={pin.key}
                  coordinates={pin.point as [number, number]}
                  className="map-pin"
                  data-selected={chosen ? "true" : undefined}
                  onClick={(event: React.MouseEvent) => {
                    if (wasDrag(press.current, event)) return;
                    if (chosen) setSelected(null);
                    else goTo(pin);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${label(pin)} — ${pin.entries.length} application${
                    pin.entries.length === 1 ? "" : "s"
                  }`}
                  onKeyDown={(event: React.KeyboardEvent) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      if (chosen) setSelected(null);
                      else goTo(pin);
                    }
                  }}
                >
                  {chosen && <circle className="map-ping" r={r} />}
                  <circle r={r} />
                  <title>
                    {label(pin)} — {pin.entries.length}
                  </title>
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>

        <p className="map-legend">
          <span>{pins.length} places</span>
          <span>Drag to pan · ⌘ or ctrl + scroll to zoom</span>
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
              Click a pin to read the applications behind it, or pick a place here — the map travels
              to it either way.
            </p>
            <ul className="map-list">
              {pins.slice(0, 6).map((pin, index) => (
                <li key={pin.key}>
                  <button
                    type="button"
                    className="w-full cursor-pointer text-left"
                    onClick={() => goTo(pin)}
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

/**
 * The rule lives in `@/lib/geo/view`, where it can be read and tested without a
 * browser. This is only the adapter: the published types describe the callback
 * as receiving the element, while the implementation passes the DOM event, so
 * the mismatch is narrowed here once rather than cast at the point of use.
 */
const GESTURE_FILTER = ((event: Event) =>
  claimsGesture(event as MouseEvent)) as unknown as ZoomableGroupProps["filterZoomEvent"];

function Glyph({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d={d} />
    </svg>
  );
}
