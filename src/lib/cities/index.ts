import { COUNTRIES } from "./data";

export { COUNTRIES } from "./data";
export type { CountryEntry } from "./data";

export type CityMatch = {
  /** Canonical English name — this is what gets stored. */
  city: string;
  country: string;
};

type IndexedCity = CityMatch & {
  /** City name and all of its aliases, folded for comparison. */
  keys: readonly string[];
  countryKeys: readonly string[];
};

/** "São Paulo" → "sao paulo". Accents must not stand between typing and finding. */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const INDEX: readonly IndexedCity[] = COUNTRIES.flatMap((country) => {
  const countryKeys = [country.name, ...(country.aliases ?? [])].map(fold);
  return country.cities.map((entry) => {
    const [canonical, ...alternates] = typeof entry === "string" ? ([entry] as const) : entry;
    const names = [canonical, ...alternates];
    return {
      city: canonical,
      country: country.name,
      keys: names.map(fold),
      countryKeys,
    };
  });
});

export const CITY_COUNT = INDEX.length;

/**
 * Autocomplete for the city field. Prefix matches come first — they are what
 * someone typing "ber" expects — then substring and country matches.
 */
export function searchCities(term: string, limit = 8): CityMatch[] {
  const needle = fold(term);
  if (needle.length < 2) return [];

  const prefix: CityMatch[] = [];
  const rest: CityMatch[] = [];

  for (const item of INDEX) {
    if (item.keys.some((key) => key.startsWith(needle))) {
      prefix.push({ city: item.city, country: item.country });
      if (prefix.length >= limit) break;
    } else if (
      item.keys.some((key) => key.includes(needle)) ||
      item.countryKeys.some((key) => key.startsWith(needle))
    ) {
      rest.push({ city: item.city, country: item.country });
    }
  }

  return [...prefix, ...rest].slice(0, limit);
}

/** Exact resolution, used when a value arrives from an import instead of the UI. */
export function resolveCity(term: string): CityMatch | null {
  const needle = fold(term);
  if (!needle) return null;
  const hit = INDEX.find((item) => item.keys.includes(needle));
  return hit ? { city: hit.city, country: hit.country } : null;
}

/** The country a city belongs to, or null when we do not know it. */
export function countryOf(city: string): string | null {
  return resolveCity(city)?.country ?? null;
}
