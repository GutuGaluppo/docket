import { describe, expect, it } from "vitest";

import {
  claimsGesture,
  clampZoom,
  focusOn,
  isWorld,
  MAX_ZOOM,
  MIN_ZOOM,
  PIN_ZOOM,
  wasDrag,
  WORLD,
  zoomBy,
  ZOOM_STEP,
} from "./view";

describe("zooming", () => {
  it("never leaves the bounds, however many times the button is pressed", () => {
    let view = WORLD;
    for (let press = 0; press < 40; press += 1) view = zoomBy(view, ZOOM_STEP);
    expect(view.zoom).toBe(MAX_ZOOM);

    for (let press = 0; press < 40; press += 1) view = zoomBy(view, 1 / ZOOM_STEP);
    expect(view.zoom).toBe(MIN_ZOOM);
  });

  it("leaves the centre where it was — zooming is not travelling", () => {
    const view = zoomBy({ coordinates: [13.4, 52.5], zoom: 2 }, ZOOM_STEP);
    expect(view.coordinates).toEqual([13.4, 52.5]);
  });

  it("clamps a value from outside", () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(1000)).toBe(MAX_ZOOM);
    expect(clampZoom(3)).toBe(3);
  });
});

describe("travelling to a place", () => {
  const berlin: [number, number] = [13.405, 52.52];
  const munich: [number, number] = [11.582, 48.135];

  it("moves in far enough to read a city when the view was the whole world", () => {
    expect(focusOn(WORLD, berlin)).toEqual({ coordinates: berlin, zoom: PIN_ZOOM });
  });

  it("does not undo a zoom the reader dialled in themselves", () => {
    // The bug this exists to prevent: clicking a second pin at high zoom
    // yanking the map back out to the default.
    const close = focusOn({ coordinates: berlin, zoom: 12 }, munich);
    expect(close).toEqual({ coordinates: munich, zoom: 12 });
  });
});

describe("the reset button", () => {
  it("is only inert on the exact view it returns to", () => {
    expect(isWorld(WORLD)).toBe(true);
    // A fresh object with the same numbers still counts — the check is by
    // value, because every gesture hands back a newly built pair.
    expect(isWorld({ coordinates: [...WORLD.coordinates], zoom: WORLD.zoom })).toBe(true);
    expect(isWorld({ ...WORLD, zoom: 1.2 })).toBe(false);
    expect(isWorld({ ...WORLD, coordinates: [0, 0] })).toBe(false);
  });
});

describe("which gestures the map claims", () => {
  it("leaves a plain wheel to the page it is embedded in", () => {
    expect(claimsGesture({ type: "wheel" })).toBe(false);
  });

  it("takes the wheel when it is a zoom gesture", () => {
    // A trackpad pinch arrives as a wheel event with ctrlKey set.
    expect(claimsGesture({ type: "wheel", ctrlKey: true })).toBe(true);
    expect(claimsGesture({ type: "wheel", metaKey: true })).toBe(true);
  });

  it("takes a plain drag and a touch", () => {
    expect(claimsGesture({ type: "mousedown", button: 0 })).toBe(true);
    expect(claimsGesture({ type: "touchstart" })).toBe(true);
  });

  it("leaves the context menu alone", () => {
    expect(claimsGesture({ type: "mousedown", button: 2 })).toBe(false);
    // ctrl-click is the right button on macOS.
    expect(claimsGesture({ type: "mousedown", button: 0, ctrlKey: true })).toBe(false);
  });
});

describe("telling a drag from a click", () => {
  it("counts a still pointer as a click", () => {
    expect(wasDrag({ x: 100, y: 100 }, { clientX: 102, clientY: 101 })).toBe(false);
  });

  it("counts a pan as a drag, so it does not select what it ends on", () => {
    expect(wasDrag({ x: 100, y: 100 }, { clientX: 260, clientY: 140 })).toBe(true);
  });

  it("treats a release with no recorded press as a click", () => {
    expect(wasDrag(null, { clientX: 0, clientY: 0 })).toBe(false);
  });
});
