/**
 * Where a place is, so the register can be drawn as a map.
 *
 * The entries store a city name and a country name and nothing else, which is
 * the right thing to store — a coordinate typed into a form is a coordinate
 * nobody checks. Turning those names into points is this file's whole job, and
 * it does it from a table rather than a geocoding service for the same reason
 * the city autocomplete is local: the map must draw instantly, must work
 * offline, and must not tell a third party where somebody is applying for work.
 *
 * Two tables, in order of preference. A city that is named here is placed
 * exactly; a city that is not falls back to the centre of its country, which is
 * honest — the pin says "somewhere in Poland", and the list behind it says
 * which city. Everything is `[longitude, latitude]`, which is the order every
 * projection in the d3 family expects and the opposite of the order people say
 * out loud.
 */
export type Point = readonly [longitude: number, latitude: number];

/**
 * Natural Earth names the countries in the world atlas its own way, and the
 * register stores the names the city base uses. Only two of the forty-six
 * disagree, so this is a correction table rather than a translation layer.
 */
const ATLAS_NAMES: Readonly<Record<string, string>> = {
  "United States": "United States of America",
  Türkiye: "Turkey",
};

/** The name this country carries in the world atlas the map is drawn from. */
export function atlasName(country: string): string {
  return ATLAS_NAMES[country] ?? country;
}

/**
 * A rough centre for each country the city base knows about. Not the
 * mathematical centroid in every case — for countries where almost all the work
 * is in one corner, the point is pulled towards where the jobs are, because a
 * pin in an empty desert is technically correct and useless.
 */
const COUNTRY_POINTS: Readonly<Record<string, Point>> = {
  Germany: [10.45, 51.17],
  Portugal: [-8.22, 39.55],
  Spain: [-3.7, 40.42],
  Netherlands: [5.29, 52.13],
  "United Kingdom": [-2.0, 53.0],
  Ireland: [-8.24, 53.41],
  France: [2.35, 46.6],
  Italy: [12.57, 42.5],
  Switzerland: [8.23, 46.82],
  Austria: [14.55, 47.52],
  Belgium: [4.47, 50.85],
  Sweden: [16.32, 59.33],
  Denmark: [10.0, 56.0],
  Norway: [9.0, 60.5],
  Finland: [25.75, 61.92],
  Poland: [19.15, 51.92],
  Czechia: [15.47, 49.82],
  Estonia: [25.01, 58.6],
  Latvia: [24.6, 56.88],
  Lithuania: [23.88, 55.17],
  Romania: [24.97, 45.94],
  Hungary: [19.5, 47.16],
  Bulgaria: [25.49, 42.73],
  Greece: [21.82, 39.07],
  Croatia: [15.2, 45.1],
  Serbia: [20.9, 44.02],
  Slovenia: [14.99, 46.15],
  Slovakia: [19.7, 48.67],
  Luxembourg: [6.13, 49.82],
  Malta: [14.38, 35.94],
  Ukraine: [31.17, 48.38],
  Türkiye: [32.86, 39.0],
  "United States": [-98.35, 39.5],
  Canada: [-96.0, 56.13],
  Mexico: [-102.55, 23.63],
  Brazil: [-47.0, -14.24],
  Argentina: [-63.62, -34.0],
  Chile: [-70.65, -33.46],
  Colombia: [-74.3, 4.57],
  Uruguay: [-56.0, -33.0],
  Peru: [-76.0, -10.0],
  "Costa Rica": [-84.09, 9.75],
  Panama: [-79.53, 8.54],
  Australia: [147.0, -33.5],
  "New Zealand": [174.89, -40.9],
  Japan: [138.25, 36.2],
  "South Korea": [127.77, 36.5],
  Singapore: [103.82, 1.35],
  China: [116.4, 39.9],
  India: [78.96, 20.59],
  Thailand: [100.99, 15.87],
  Vietnam: [108.28, 14.06],
  Philippines: [121.77, 12.88],
  Malaysia: [101.98, 4.21],
  "United Arab Emirates": [54.0, 24.0],
  Israel: [34.85, 31.85],
  "Saudi Arabia": [45.08, 23.89],
  "South Africa": [24.0, -29.0],
};

/**
 * The cities the register is most likely to hold. Keyed by the canonical
 * English name the city base stores, which is the name that reaches the
 * database — aliases were resolved before anything was written.
 */
const CITY_POINTS: Readonly<Record<string, Point>> = {
  // Germany
  Berlin: [13.405, 52.52],
  Munich: [11.582, 48.135],
  Hamburg: [9.993, 53.551],
  Cologne: [6.96, 50.938],
  Frankfurt: [8.682, 50.11],
  Stuttgart: [9.182, 48.776],
  Düsseldorf: [6.773, 51.228],
  Leipzig: [12.374, 51.34],
  Dresden: [13.738, 51.05],
  Hanover: [9.732, 52.376],
  Nuremberg: [11.077, 49.452],
  Karlsruhe: [8.404, 49.007],
  Bremen: [8.802, 53.079],
  Essen: [7.013, 51.456],
  Dortmund: [7.466, 51.514],
  Freiburg: [7.843, 47.999],
  Heidelberg: [8.673, 49.399],
  Münster: [7.626, 51.961],
  Aachen: [6.084, 50.776],
  Potsdam: [13.064, 52.391],

  // Portugal
  Lisbon: [-9.139, 38.722],
  Porto: [-8.611, 41.15],
  Braga: [-8.427, 41.545],
  Coimbra: [-8.42, 40.204],
  Aveiro: [-8.654, 40.641],
  Faro: [-7.935, 37.019],
  Funchal: [-16.924, 32.65],
  Guimarães: [-8.29, 41.444],
  Leiria: [-8.807, 39.744],
  Setúbal: [-8.893, 38.525],
  Évora: [-7.909, 38.571],
  Viseu: [-7.913, 40.661],

  // Spain
  Madrid: [-3.703, 40.417],
  Barcelona: [2.173, 41.385],
  Valencia: [-0.376, 39.47],
  Seville: [-5.984, 37.389],
  Bilbao: [-2.935, 43.263],
  Málaga: [-4.421, 36.721],
  Zaragoza: [-0.889, 41.649],
  "Palma de Mallorca": [2.65, 39.57],
  Alicante: [-0.481, 38.345],
  Granada: [-3.599, 37.177],
  "Las Palmas": [-15.414, 28.124],
  "Santa Cruz de Tenerife": [-16.251, 28.464],

  // Netherlands
  Amsterdam: [4.904, 52.367],
  Rotterdam: [4.478, 51.924],
  "The Hague": [4.301, 52.07],
  Utrecht: [5.121, 52.091],
  Eindhoven: [5.469, 51.441],
  Groningen: [6.567, 53.219],
  Delft: [4.357, 52.012],
  Leiden: [4.497, 52.16],
  Haarlem: [4.646, 52.381],
  Nijmegen: [5.852, 51.812],

  // United Kingdom and Ireland
  London: [-0.128, 51.507],
  Manchester: [-2.244, 53.481],
  Edinburgh: [-3.189, 55.953],
  Bristol: [-2.587, 51.455],
  Cambridge: [0.122, 52.205],
  Oxford: [-1.258, 51.752],
  Birmingham: [-1.898, 52.489],
  Leeds: [-1.549, 53.801],
  Glasgow: [-4.252, 55.864],
  Brighton: [-0.137, 50.822],
  Liverpool: [-2.978, 53.408],
  Belfast: [-5.93, 54.597],
  Cardiff: [-3.179, 51.481],
  Sheffield: [-1.47, 53.381],
  Newcastle: [-1.613, 54.978],
  Reading: [-0.974, 51.454],
  Dublin: [-6.26, 53.35],
  Cork: [-8.471, 51.898],
  Galway: [-9.049, 53.27],
  Limerick: [-8.624, 52.664],

  // France
  Paris: [2.352, 48.857],
  Lyon: [4.835, 45.764],
  Marseille: [5.369, 43.296],
  Toulouse: [1.444, 43.605],
  Bordeaux: [-0.58, 44.838],
  Nice: [7.262, 43.71],
  Nantes: [-1.553, 47.218],
  Lille: [3.058, 50.629],
  Strasbourg: [7.751, 48.573],
  Montpellier: [3.877, 43.611],
  Rennes: [-1.68, 48.117],
  Grenoble: [5.724, 45.188],
  "Sophia Antipolis": [7.048, 43.623],

  // Italy
  Milan: [9.19, 45.464],
  Rome: [12.496, 41.903],
  Turin: [7.687, 45.07],
  Bologna: [11.343, 44.494],
  Florence: [11.256, 43.77],
  Naples: [14.268, 40.852],
  Venice: [12.316, 45.44],
  Padua: [11.876, 45.407],
  Trento: [11.121, 46.069],
  Pisa: [10.402, 43.723],
  Genoa: [8.947, 44.406],
  Verona: [10.993, 45.438],

  // Switzerland and Austria
  Zurich: [8.542, 47.377],
  Geneva: [6.143, 46.204],
  Basel: [7.589, 47.559],
  Bern: [7.447, 46.948],
  Lausanne: [6.633, 46.519],
  Lugano: [8.952, 46.005],
  Zug: [8.517, 47.172],
  Winterthur: [8.724, 47.5],
  Vienna: [16.373, 48.208],
  Graz: [15.439, 47.071],
  Linz: [14.286, 48.306],
  Salzburg: [13.055, 47.809],
  Innsbruck: [11.404, 47.269],

  // Belgium and Luxembourg
  Brussels: [4.352, 50.847],
  Antwerp: [4.402, 51.219],
  Ghent: [3.725, 51.054],
  Leuven: [4.7, 50.879],
  Bruges: [3.225, 51.209],
  Liège: [5.577, 50.633],
  Luxembourg: [6.13, 49.611],

  // The Nordics
  Stockholm: [18.069, 59.329],
  Gothenburg: [11.974, 57.709],
  Malmö: [13.003, 55.605],
  Uppsala: [17.638, 59.858],
  Lund: [13.194, 55.705],
  Linköping: [15.622, 58.41],
  Copenhagen: [12.568, 55.676],
  Aarhus: [10.204, 56.163],
  Odense: [10.404, 55.403],
  Aalborg: [9.922, 57.048],
  Oslo: [10.752, 59.914],
  Helsinki: [24.941, 60.169],
  Espoo: [24.656, 60.205],
  Tampere: [23.761, 61.498],
  Turku: [22.267, 60.452],
  Oulu: [25.472, 65.012],

  // Central and eastern Europe
  Warsaw: [21.012, 52.23],
  Kraków: [19.945, 50.065],
  Wrocław: [17.038, 51.108],
  Poznań: [16.926, 52.407],
  Gdańsk: [18.646, 54.352],
  Łódź: [19.457, 51.759],
  Katowice: [19.021, 50.265],
  Prague: [14.438, 50.076],
  Brno: [16.607, 49.195],
  Ostrava: [18.263, 49.821],
  Plzeň: [13.378, 49.745],
  Tallinn: [24.754, 59.437],
  Riga: [24.105, 56.95],
  Vilnius: [25.28, 54.687],
  Bucharest: [26.103, 44.427],
  "Cluj-Napoca": [23.6, 46.771],
  Timișoara: [21.227, 45.748],
  Iași: [27.601, 47.157],
  Brașov: [25.601, 45.657],
  Budapest: [19.04, 47.498],
  Debrecen: [21.626, 47.532],
  Szeged: [20.148, 46.253],
  Sofia: [23.322, 42.698],
  Plovdiv: [24.749, 42.144],
  Varna: [27.911, 43.214],
  Athens: [23.728, 37.984],
  Thessaloniki: [22.944, 40.64],
  Patras: [21.735, 38.246],
  Zagreb: [15.982, 45.815],
  Belgrade: [20.457, 44.787],
  "Novi Sad": [19.834, 45.267],
  Niš: [21.896, 43.321],
  Ljubljana: [14.506, 46.056],
  Maribor: [15.646, 46.554],
  Bratislava: [17.107, 48.146],
  Valletta: [14.514, 35.899],
  Sliema: [14.503, 35.913],
  Kyiv: [30.523, 50.45],
  Lviv: [24.032, 49.84],
  Kharkiv: [36.231, 49.994],
  Odesa: [30.733, 46.482],
  Istanbul: [28.979, 41.008],
  Ankara: [32.854, 39.933],
  Izmir: [27.142, 38.424],

  // North America
  "San Francisco": [-122.419, 37.775],
  "New York": [-74.006, 40.713],
  Seattle: [-122.332, 47.606],
  Austin: [-97.743, 30.267],
  Boston: [-71.059, 42.36],
  "Los Angeles": [-118.244, 34.052],
  Chicago: [-87.63, 41.878],
  Denver: [-104.991, 39.739],
  Miami: [-80.192, 25.762],
  Atlanta: [-84.388, 33.749],
  Portland: [-122.676, 45.512],
  "San Diego": [-117.161, 32.716],
  Washington: [-77.037, 38.907],
  Philadelphia: [-75.165, 39.953],
  Dallas: [-96.797, 32.777],
  Houston: [-95.369, 29.76],
  Phoenix: [-112.074, 33.448],
  Nashville: [-86.781, 36.163],
  Pittsburgh: [-79.996, 40.441],
  Minneapolis: [-93.265, 44.978],
  Raleigh: [-78.638, 35.779],
  "Salt Lake City": [-111.891, 40.761],
  "San Jose": [-121.887, 37.339],
  "Palo Alto": [-122.143, 37.442],
  Toronto: [-79.383, 43.653],
  Vancouver: [-123.121, 49.283],
  Montreal: [-73.568, 45.502],
  Ottawa: [-75.697, 45.421],
  Calgary: [-114.071, 51.045],
  Waterloo: [-80.516, 43.465],
  "Quebec City": [-71.208, 46.814],
  Edmonton: [-113.491, 53.546],
  Halifax: [-63.573, 44.649],
  Victoria: [-123.366, 48.428],
  "Mexico City": [-99.133, 19.433],
  Guadalajara: [-103.35, 20.659],
  Monterrey: [-100.317, 25.687],
  Querétaro: [-100.39, 20.589],
  Mérida: [-89.592, 20.968],
  Puebla: [-98.206, 19.041],
  Tijuana: [-117.038, 32.514],

  // Brazil
  "São Paulo": [-46.633, -23.551],
  "Rio de Janeiro": [-43.173, -22.907],
  "Belo Horizonte": [-43.938, -19.917],
  Curitiba: [-49.273, -25.428],
  "Porto Alegre": [-51.23, -30.033],
  Florianópolis: [-48.548, -27.595],
  Brasília: [-47.883, -15.794],
  Recife: [-34.877, -8.048],
  Fortaleza: [-38.527, -3.732],
  Salvador: [-38.501, -12.977],
  Campinas: [-47.061, -22.906],
  Goiânia: [-49.254, -16.686],
  Manaus: [-60.025, -3.119],
  Belém: [-48.504, -1.456],
  Vitória: [-40.338, -20.319],
  Natal: [-35.209, -5.795],
  "João Pessoa": [-34.861, -7.115],
  Maceió: [-35.735, -9.666],
  "São José dos Campos": [-45.887, -23.179],
  Joinville: [-48.846, -26.304],
  Londrina: [-51.163, -23.31],
  "Ribeirão Preto": [-47.81, -21.178],
  Uberlândia: [-48.277, -18.919],
  Santos: [-46.333, -23.961],
  Sorocaba: [-47.458, -23.502],
  Blumenau: [-49.066, -26.919],
  "Caxias do Sul": [-51.179, -29.168],
  Niterói: [-43.104, -22.884],
  "Campo Grande": [-54.646, -20.469],
  Cuiabá: [-56.097, -15.601],
  Teresina: [-42.804, -5.092],
  "São Luís": [-44.302, -2.53],
  Aracaju: [-37.073, -10.947],
  Palmas: [-48.336, -10.184],
  "Juiz de Fora": [-43.35, -21.764],

  // The rest of the Americas
  "Buenos Aires": [-58.382, -34.604],
  Córdoba: [-64.183, -31.42],
  Rosario: [-60.639, -32.958],
  Mendoza: [-68.844, -32.889],
  "La Plata": [-57.955, -34.921],
  Santiago: [-70.649, -33.457],
  Valparaíso: [-71.612, -33.047],
  Concepción: [-73.05, -36.827],
  "Viña del Mar": [-71.552, -33.024],
  Bogotá: [-74.073, 4.711],
  Medellín: [-75.564, 6.244],
  Cali: [-76.522, 3.452],
  Barranquilla: [-74.797, 10.968],
  Cartagena: [-75.514, 10.391],
  Montevideo: [-56.164, -34.902],
  "Punta del Este": [-54.95, -34.947],
  Lima: [-77.043, -12.046],
  "San José": [-84.088, 9.928],
  "Panama City": [-79.516, 8.983],

  // Asia and the Pacific
  Sydney: [151.209, -33.868],
  Auckland: [174.764, -36.848],
  Tokyo: [139.692, 35.69],
  Osaka: [135.502, 34.694],
  Kyoto: [135.768, 35.011],
  Yokohama: [139.638, 35.444],
  Fukuoka: [130.402, 33.59],
  Nagoya: [136.907, 35.181],
  Seoul: [126.978, 37.567],
  Busan: [129.075, 35.18],
  Incheon: [126.705, 37.456],
  Singapore: [103.82, 1.352],
  Shanghai: [121.474, 31.23],
  Beijing: [116.407, 39.904],
  Shenzhen: [114.058, 22.543],
  Hangzhou: [120.155, 30.274],
  Guangzhou: [113.264, 23.129],
  "Hong Kong": [114.169, 22.319],
  Bangalore: [77.595, 12.972],
  Hyderabad: [78.486, 17.385],
  Mumbai: [72.878, 19.076],
  Pune: [73.856, 18.52],
  Delhi: [77.209, 28.614],
  Chennai: [80.271, 13.083],
  Gurgaon: [77.026, 28.46],
  Noida: [77.391, 28.535],
  Bangkok: [100.502, 13.756],
  "Chiang Mai": [98.987, 18.788],
  "Ho Chi Minh City": [106.66, 10.823],
  Hanoi: [105.834, 21.028],
  "Da Nang": [108.202, 16.055],
  Manila: [120.984, 14.599],
  "Kuala Lumpur": [101.687, 3.139],
  Dubai: [55.271, 25.205],
  "Tel Aviv": [34.781, 32.085],
  Haifa: [34.989, 32.794],
  Riyadh: [46.675, 24.713],
  Jeddah: [39.197, 21.486],

  // Africa
  "Cape Town": [18.424, -33.925],
  Johannesburg: [28.048, -26.204],
  Durban: [31.022, -29.859],
  Pretoria: [28.188, -25.746],
};

/**
 * Where to draw a place, and how confident the map is about it.
 *
 * Returns null for anything that is not a place at all. "Remote — Europe" is a
 * perfectly good thing to have applied to and a meaningless thing to put a pin
 * on, and pretending otherwise would put a cluster in the middle of the
 * Atlantic that nobody could interpret.
 */
export function locate(
  city: string | null,
  country: string | null,
): { point: Point; precision: "city" | "country" } | null {
  if (country === "Remote" || city?.startsWith("Remote")) return null;

  if (city) {
    const exact = CITY_POINTS[city];
    if (exact) return { point: exact, precision: "city" };
  }

  if (country) {
    const centre = COUNTRY_POINTS[country];
    if (centre) return { point: centre, precision: "country" };
  }

  return null;
}
