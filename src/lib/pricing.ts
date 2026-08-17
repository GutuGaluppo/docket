/**
 * Pricing, and where it bends.
 *
 * Section 7 of the brief: charge proportionally in markets where €5 is not €5.
 * The discount is applied by country, announced in plain text on the page, and
 * never hidden behind an asterisk — a price that changes silently by IP reads
 * as a trick even when it is generosity.
 */
export const PRO_MONTHLY_EUR = 5;
export const PRO_YEARLY_EUR = 48;

/** ~60% off. Brazil, most of Latin America, India. */
const PPP_DISCOUNT = 0.6;

const PPP_COUNTRIES = new Set([
  "BR", "AR", "CO", "CL", "PE", "UY", "PY", "BO", "EC", "VE",
  "MX", "GT", "HN", "SV", "NI", "CR", "PA", "DO",
  "IN", "PK", "BD", "LK", "NP",
]);

export type Pricing = {
  monthly: number;
  yearly: number;
  currency: string;
  /** Set only when a regional adjustment was applied, so the page can say so. */
  adjustedFor: string | null;
};

const COUNTRY_NAMES: Record<string, string> = {
  BR: "Brazil", AR: "Argentina", CO: "Colombia", CL: "Chile", PE: "Peru",
  MX: "Mexico", IN: "India", PK: "Pakistan", BD: "Bangladesh",
};

const round = (value: number) => Math.max(1, Math.round(value));

export function priceFor(country: string | null): Pricing {
  const code = country?.toUpperCase() ?? "";
  if (!PPP_COUNTRIES.has(code)) {
    return {
      monthly: PRO_MONTHLY_EUR,
      yearly: PRO_YEARLY_EUR,
      currency: "€",
      adjustedFor: null,
    };
  }

  return {
    monthly: round(PRO_MONTHLY_EUR * (1 - PPP_DISCOUNT)),
    yearly: round(PRO_YEARLY_EUR * (1 - PPP_DISCOUNT)),
    currency: "€",
    adjustedFor: COUNTRY_NAMES[code] ?? "your country",
  };
}
