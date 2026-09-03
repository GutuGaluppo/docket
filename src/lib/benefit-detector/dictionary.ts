/**
 * What a job offers, as a dictionary.
 *
 * The key is how the benefit is shown; the array holds every spelling that can
 * appear inside an ad. Aliases stay lowercase — the scanner lowercases the
 * haystack before reading it.
 *
 * German and Portuguese sit beside English because the register is kept by
 * people applying across borders, and a Berlin ad naming "Urlaubstage" or a
 * Brazilian one naming "vale refeição" is describing the same thing an English
 * ad calls paid leave or a meal allowance.
 *
 * Adding an alias is safe. Adding a *short* or *common* one is not, and the
 * failure here is worse than in the technology dictionary, because the words
 * benefits are written with are ordinary words:
 *
 * - "bonus" is out. Ads say "Bonus: experience with Kubernetes" constantly.
 * - "equity" is out. Nearly every ad carries a "diversity, equity and
 *   inclusion" line, and none of those are offering shares.
 * - "training" is out. It matches model training in any ML ad.
 * - "flexible" and "leave" are out on their own; they need their noun.
 *
 * Prefer a missing benefit over a wrong one. The list is editable by hand, and
 * a person adding one back costs less than a person hunting for why the
 * register claims a job offered something it never mentioned.
 */
export const BENEFITS: Record<string, readonly string[]> = {
  "Remote work": [
    "fully remote",
    "remote-first",
    "remote first",
    "work from home",
    "work remotely",
    "remote work",
    "home office",
    "100% remote",
    "trabalho remoto",
    "home-office",
  ],
  Hybrid: ["hybrid model", "hybrid working", "hybrid work", "hybrid setup", "modelo híbrido"],
  Workation: ["workation", "work from abroad", "work from anywhere", "working abroad"],
  "Flexible hours": [
    "flexible hours",
    "flexible working hours",
    "flexible schedule",
    "flexitime",
    "flextime",
    "gleitzeit",
    "vertrauensarbeitszeit",
    "horário flexível",
  ],
  "Four-day week": ["four-day week", "4-day week", "4 day week", "vier-tage-woche"],
  "Paid leave": [
    "paid time off",
    "vacation days",
    "days of vacation",
    "days of paid leave",
    "annual leave",
    "urlaubstage",
    "urlaub pro jahr",
    "dias de férias",
  ],
  Sabbatical: ["sabbatical", "sabbatical leave"],
  "Parental leave": [
    "parental leave",
    "maternity leave",
    "paternity leave",
    "elternzeit",
    "licença maternidade",
    "licença paternidade",
  ],
  "Health insurance": [
    "health insurance",
    "private health insurance",
    "medical insurance",
    "health cover",
    "healthcare plan",
    "krankenversicherung",
    "private krankenversicherung",
    "plano de saúde",
    "assistência médica",
  ],
  "Dental cover": ["dental insurance", "dental cover", "dental plan", "plano odontológico"],
  "Mental health support": [
    "mental health support",
    "mental health budget",
    "therapy sessions",
    "psychological support",
    "nilo health",
    "likeminded",
    "apoio psicológico",
  ],
  "Life insurance": ["life insurance", "seguro de vida"],
  Pension: [
    "pension scheme",
    "pension plan",
    "company pension",
    "retirement plan",
    "401k",
    "401(k)",
    "betriebliche altersvorsorge",
    "altersvorsorge",
    "previdência privada",
  ],
  "Stock options": [
    "stock options",
    "share options",
    "employee stock",
    "equity package",
    "virtual shares",
    "vsop",
    "esop",
    "rsus",
    "restricted stock",
    "participação acionária",
  ],
  "Profit sharing": [
    "profit sharing",
    "profit-sharing",
    "performance bonus",
    "annual bonus",
    "signing bonus",
    "13th salary",
    "13º salário",
    "participação nos lucros",
  ],
  "Learning budget": [
    "learning budget",
    "training budget",
    "development budget",
    "education budget",
    "conference budget",
    "professional development",
    "personal development budget",
    "weiterbildungsbudget",
    "fortbildungsbudget",
    "budget de estudos",
  ],
  "Language classes": [
    "language classes",
    "language courses",
    "german classes",
    "german lessons",
    "sprachkurse",
    "deutschkurs",
    "aulas de idiomas",
  ],
  "Equipment budget": [
    "equipment budget",
    "home office budget",
    "home office allowance",
    "hardware of your choice",
    "latest macbook",
    "equipment of your choice",
    "auxílio home office",
  ],
  "Gym & wellness": [
    "urban sports club",
    "gympass",
    "wellpass",
    "gym membership",
    "fitness allowance",
    "wellness budget",
    "fitnessstudio",
    "wellhub",
  ],
  "Transport ticket": [
    "public transport ticket",
    "transport allowance",
    "commuter benefit",
    "travel card",
    "deutschlandticket",
    "bvg ticket",
    "jobticket",
    "fahrtkostenzuschuss",
    "vale transporte",
  ],
  "Bike leasing": ["bike leasing", "jobrad", "cycle to work", "company bike"],
  "Company car": ["company car", "firmenwagen", "dienstwagen", "carro da empresa"],
  "Meal allowance": [
    "meal allowance",
    "meal vouchers",
    "lunch allowance",
    "free lunch",
    "lunch is on us",
    "essenszuschuss",
    "vale refeição",
    "vale alimentação",
    "ticket restaurant",
  ],
  "Snacks & drinks": [
    "free snacks",
    "snacks and drinks",
    "fruit and coffee",
    "free breakfast",
    "kostenlose getränke",
    "obst und kaffee",
  ],
  Childcare: [
    "childcare support",
    "childcare allowance",
    "kindergarten allowance",
    "kita-zuschuss",
    "kitazuschuss",
    "auxílio creche",
  ],
  "Relocation support": [
    "relocation package",
    "relocation support",
    "relocation assistance",
    "relocation bonus",
    "umzugshilfe",
    "auxílio mudança",
  ],
  "Visa sponsorship": [
    "visa sponsorship",
    "visa support",
    "sponsor your visa",
    "work permit support",
    "blue card support",
    "visa relocation",
  ],
  "Team events": [
    "team events",
    "company retreat",
    "team retreat",
    "offsites",
    "offsite",
    "team offsite",
    "teamevents",
    "firmenevents",
  ],
  "Employee discounts": [
    "employee discount",
    "employee discounts",
    "corporate benefits",
    "mitarbeiterrabatte",
    "descontos para funcionários",
  ],
  "Referral bonus": ["referral bonus", "referral programme", "referral program"],
};

/** Every benefit the detector can produce, for the field's own suggestions. */
export const KNOWN_BENEFITS: readonly string[] = Object.keys(BENEFITS);
