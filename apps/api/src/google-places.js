const API_URL = "https://places.googleapis.com/v1/places:searchText";
const PRICE_LEVELS = ["PRICE_LEVEL_UNSPECIFIED", "PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"];
const CUISINE_QUERIES = new Map([
  ["japonesa", "Japanese restaurant"], ["italiana", "Italian restaurant"],
  ["brasileira", "Brazilian restaurant"], ["árabe", "Middle Eastern restaurant"],
  ["hambúrguer", "Hamburger restaurant"], ["vegetariana", "Vegetarian restaurant"],
  ["chinesa", "Chinese restaurant"], ["mexicana", "Mexican restaurant"],
  ["indiana", "Indian restaurant"], ["mediterrânea", "Mediterranean restaurant"],
  ["cafeteria", "Cafe"], ["bar", "Bar"]
]);
const CUISINE_LABELS = [
  [/japan|sushi|ramen/, "Japonesa"], [/ital|pizza/, "Italiana"],
  [/brazil|churrasc|botequim/, "Brasileira"], [/middle eastern|arab|lebanese/, "Árabe"],
  [/hamburger|burger/, "Hambúrguer"], [/vegetarian|vegan/, "Vegetariana"],
  [/chinese|dim sum/, "Chinesa"], [/mexican|taco/, "Mexicana"],
  [/indian|curry/, "Indiana"], [/mediterranean|greek|turkish/, "Mediterrânea"],
  [/coffee|cafe|cafeteria/, "Cafeteria"], [/bar|pub|brewery/, "Bar"]
];
const BASIC_FIELDS = [
  "places.id", "places.displayName", "places.formattedAddress", "places.location",
  "places.types", "places.primaryTypeDisplayName", "places.googleMapsUri", "nextPageToken"
];
const ENTERPRISE_FIELDS = ["places.priceLevel", "places.rating", "places.userRatingCount", "places.websiteUri"];

export function isGooglePlacesConfigured() {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());
}

export function googleEnterpriseFieldsEnabled() {
  return process.env.GOOGLE_PLACES_INCLUDE_ENTERPRISE_FIELDS === "true";
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch { return null; }
}

function cuisineLabel(place) {
  const text = `${place?.primaryTypeDisplayName?.text || ""} ${(place?.types || []).join(" ")}`.toLocaleLowerCase("en-US");
  return CUISINE_LABELS.find(([pattern]) => pattern.test(text))?.[1] || place?.primaryTypeDisplayName?.text || "Restaurante";
}

function mapPlace(place) {
  const id = typeof place?.id === "string" ? place.id.trim() : "";
  const name = typeof place?.displayName?.text === "string" ? place.displayName.text.trim() : "";
  const lat = Number(place?.location?.latitude);
  const lng = Number(place?.location?.longitude);
  const sourceUrl = safeUrl(place?.googleMapsUri);
  if (!id || !name || !sourceUrl || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const priceLevel = PRICE_LEVELS.indexOf(place.priceLevel);
  return {
    id: `google:${id}`,
    google_place_id: id,
    name,
    slug: id,
    cuisine: cuisineLabel(place),
    description: "",
    price_per_person: null,
    price_level: googleEnterpriseFieldsEnabled() && priceLevel > 0 ? priceLevel : null,
    price_level_label: googleEnterpriseFieldsEnabled() && priceLevel > 0 ? [null, "Econômico", "Moderado", "Caro", "Muito caro"][priceLevel] : null,
    rating: googleEnterpriseFieldsEnabled() && place.rating != null && Number.isFinite(Number(place.rating)) ? Number(place.rating) : null,
    rating_count: googleEnterpriseFieldsEnabled() && place.userRatingCount != null && Number.isFinite(Number(place.userRatingCount)) ? Number(place.userRatingCount) : null,
    address: typeof place.formattedAddress === "string" ? place.formattedAddress : "Endereço não informado",
    city: "São Paulo",
    state: "SP",
    lat,
    lng,
    distance_km: null,
    tags: Array.isArray(place.types) ? place.types.slice(0, 8) : [],
    image_url: null,
    image_attribution: null,
    image_source_url: null,
    menu_url: null,
    price_source_url: null,
    website_url: googleEnterpriseFieldsEnabled() ? safeUrl(place.websiteUri) : null,
    is_demo: false,
    source: "google",
    source_url: sourceUrl,
    verified_at: null,
    source_updated_at: null,
    open_now: null
  };
}

export async function searchGooglePlaces(filters = {}) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) throw new Error("A chave da API Google Places não está configurada.");

  const cuisine = filters.cuisine ? CUISINE_QUERIES.get(String(filters.cuisine).trim().toLocaleLowerCase("pt-BR")) || filters.cuisine : "";
  const queryParts = [cuisine, filters.q].filter(Boolean);
  if (!queryParts.length) queryParts.push("restaurants");
  if (!(filters.lat != null && filters.lng != null) && filters.near) queryParts.push(`in ${String(filters.near).trim().slice(0, 120)}`);

  const body = {
    textQuery: queryParts.join(" "),
    pageSize: Math.min(Math.max(Number(filters.limit) || 20, 1), 20),
    languageCode: "pt-BR",
    regionCode: "BR",
    includedType: "restaurant",
    strictTypeFiltering: true
  };
  if (filters.pageToken) body.pageToken = String(filters.pageToken).slice(0, 2048);
  if (filters.lat != null && filters.lng != null) {
    body.locationBias = { circle: {
      center: { latitude: Number(filters.lat), longitude: Number(filters.lng) },
      radius: Math.min(Math.max(Number(filters.radiusKm) || 15, 1), 50) * 1000
    } };
  }

  const fields = [...BASIC_FIELDS, ...(googleEnterpriseFieldsEnabled() ? ENTERPRISE_FIELDS : [])];
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": fields.join(",") },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
  } catch (error) {
    console.error("Google Places request failed:", error.name);
    const failure = new Error("A busca de restaurantes está temporariamente indisponível.");
    failure.status = 502;
    throw failure;
  }

  if (!response.ok) {
    console.error("Google Places returned HTTP", response.status);
    const message = response.status === 429
      ? "A busca atingiu o limite de chamadas. Tente novamente mais tarde."
      : "O Google Places recusou a busca. Confira a chave, as restrições e o faturamento no Google Cloud.";
    const failure = new Error(message);
    failure.status = response.status === 429 ? 429 : 502;
    failure.publicMessage = message;
    throw failure;
  }

  const payload = await response.json();
  let items = (Array.isArray(payload.places) ? payload.places : []).map(mapPlace).filter(Boolean);
  if (googleEnterpriseFieldsEnabled() && filters.maxPriceLevel != null) {
    items = items.filter((item) => item.price_level != null && item.price_level <= Number(filters.maxPriceLevel));
  }
  return { items, nextPageToken: typeof payload.nextPageToken === "string" ? payload.nextPageToken : null };
}

