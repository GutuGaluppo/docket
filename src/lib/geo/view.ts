import type { Point } from "./coordinates";

/**
 * What the map is looking at, and the rules for changing it.
 *
 * Kept apart from the component because none of it needs a browser and all of
 * it has edge cases: a zoom that must not escape its bounds, a click on a pin
 * that must not undo the zoom somebody just dialled in, and a wheel gesture
 * that must not be taken from the page it is scrolling. That last one is the
 * kind of rule that is invisible until it is wrong, and it is worth a test
 * rather than a careful reading.
 */
export type View = { coordinates: Point; zoom: number };

/**
 * The whole world, centred slightly north of the equator — which is where the
 * land is, and therefore where the jobs are.
 */
export const WORLD: View = { coordinates: [10, 18], zoom: 1 };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 14;

/** One press of a button: small enough to aim with, large enough to feel. */
export const ZOOM_STEP = 1.7;

/** How close a click on a pin brings you, if you were not already closer. */
export const PIN_ZOOM = 5;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** A button press. The centre is untouched — zooming is not travelling. */
export function zoomBy(view: View, factor: number): View {
  return { ...view, zoom: clampZoom(view.zoom * factor) };
}

/**
 * Travel to a place.
 *
 * The zoom only ever increases. Someone reading Berlin at twelve times in who
 * clicks Munich wants Munich, not the whole of Europe again — so a click that
 * would zoom *out* moves the centre and leaves the scale alone.
 */
export function focusOn(view: View, point: Point, atLeast = PIN_ZOOM): View {
  return { coordinates: [point[0], point[1]], zoom: Math.max(view.zoom, atLeast) };
}

/** Whether the view is the one the reset button returns to. */
export function isWorld(view: View): boolean {
  return (
    view.zoom === WORLD.zoom &&
    view.coordinates[0] === WORLD.coordinates[0] &&
    view.coordinates[1] === WORLD.coordinates[1]
  );
}

/** The parts of a DOM event this decision actually reads. */
export type Gesture = {
  type: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  button?: number;
};

/**
 * Which gestures the map is allowed to claim.
 *
 * A plain wheel belongs to the page. A map embedded in a scrolling document
 * that swallows the scroll wheel is the reason people avoid maps embedded in
 * scrolling documents — so zooming by wheel needs ⌘ or ctrl, which is also
 * exactly what a trackpad pinch reports on every platform that has one.
 *
 * Dragging is left alone, except with the right button, which belongs to the
 * context menu, and except with ctrl held, which on macOS *is* the right button.
 */
export function claimsGesture(event: Gesture): boolean {
  if (event.type === "wheel") return Boolean(event.ctrlKey || event.metaKey);
  return !event.ctrlKey && !event.button;
}

/**
 * Whether a pointer travelled far enough between press and release to have been
 * a drag rather than a click.
 *
 * d3-zoom does not suppress the click it leaves behind at the end of a pan, so
 * without this, dragging across the map would select every city on the way.
 */
export const DRAG_SLOP = 5;

export function wasDrag(
  from: { x: number; y: number } | null,
  to: { clientX: number; clientY: number },
): boolean {
  if (!from) return false;
  return Math.hypot(to.clientX - from.x, to.clientY - from.y) > DRAG_SLOP;
}
