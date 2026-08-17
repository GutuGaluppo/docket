import { describe, expect, it } from "vitest";

import { CITY_COUNT, countryOf, fold, resolveCity, searchCities } from "./index";

describe("fold", () => {
  it("strips accents and case", () => {
    expect(fold("São Paulo")).toBe("sao paulo");
    expect(fold("  Düsseldorf ")).toBe("dusseldorf");
    expect(fold("Łódź")).toBe("łodz"); // ł has no combining form; that is why aliases exist
  });
});

describe("searchCities", () => {
  it("needs at least two characters", () => {
    expect(searchCities("b")).toEqual([]);
    expect(searchCities("")).toEqual([]);
  });

  it("deduces the country from the city", () => {
    expect(searchCities("Berlin")[0]).toEqual({ city: "Berlin", country: "Germany" });
    expect(searchCities("Lisbon")[0]).toEqual({ city: "Lisbon", country: "Portugal" });
  });

  it("puts prefix matches before substring matches", () => {
    const results = searchCities("san");
    expect(results[0]?.city.toLowerCase().startsWith("san")).toBe(true);
  });

  it("finds a city typed in Portuguese but returns the canonical name", () => {
    expect(searchCities("Berlim")[0]).toEqual({ city: "Berlin", country: "Germany" });
    expect(searchCities("Munique")[0]).toEqual({ city: "Munich", country: "Germany" });
    expect(searchCities("Lisboa")[0]).toEqual({ city: "Lisbon", country: "Portugal" });
  });

  it("finds a city typed in its local language", () => {
    expect(searchCities("Köln")[0]).toEqual({ city: "Cologne", country: "Germany" });
    expect(searchCities("Wien")[0]).toEqual({ city: "Vienna", country: "Austria" });
  });

  it("ignores accents", () => {
    expect(searchCities("sao paulo")[0]).toEqual({ city: "São Paulo", country: "Brazil" });
    expect(searchCities("dusseldorf")[0]).toEqual({ city: "Düsseldorf", country: "Germany" });
  });

  it("also matches by country name", () => {
    const results = searchCities("Netherlands");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.country === "Netherlands")).toBe(true);
  });

  it("honours the result limit", () => {
    expect(searchCities("a", 8)).toEqual([]);
    expect(searchCities("ber", 3).length).toBeLessThanOrEqual(3);
  });

  it("offers the remote options", () => {
    expect(searchCities("Remote")[0]?.country).toBe("Remote");
  });
});

describe("resolveCity", () => {
  it("resolves canonical names and aliases alike", () => {
    expect(resolveCity("Berlin")).toEqual({ city: "Berlin", country: "Germany" });
    expect(resolveCity("berlim")).toEqual({ city: "Berlin", country: "Germany" });
    expect(resolveCity("MÜNCHEN")).toEqual({ city: "Munich", country: "Germany" });
  });

  it("returns null for an unknown place instead of guessing", () => {
    expect(resolveCity("Hobbiton")).toBeNull();
    expect(resolveCity("")).toBeNull();
  });
});

describe("countryOf", () => {
  it("answers for known cities and stays silent otherwise", () => {
    expect(countryOf("Toronto")).toBe("Canada");
    expect(countryOf("Hobbiton")).toBeNull();
  });
});

describe("the dataset", () => {
  it("carries every city from the prototype", () => {
    expect(CITY_COUNT).toBeGreaterThanOrEqual(320);
  });
});
