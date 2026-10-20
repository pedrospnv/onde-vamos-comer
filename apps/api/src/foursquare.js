const API_URL = "https://places-api.foursquare.com/places/search";
const API_VERSION = "2025-06-17";
const CUISINE_QUERIES = new Map([
  ["japonesa", "Japanese restaurant"], ["italiana", "Italian restaurant"],
  ["brasileira", "Brazilian restaurant"], ["árabe", "Middle Eastern restaurant"],
  ["hambúrguer", "Hamburger restaurant"], ["vegetariana", "Vegetarian restaurant"],
  ["chinesa", "Chinese restaurant"], ["mexicana", "Mexican restaurant"],
  ["indiana", "Indian restaurant"], ["mediterrânea", "Mediterranean restaurant"],
  ["cafeteria", "Coffee shop"], ["bar", "Bar"]
]);
const PRICE_LABELS = new Map([[1, "Econômico"], [2, "Moderado"], [3, "Caro"], [4, "Muito caro"]]);
const DINING_CATEGORY = /restaurant|dining|food|coffee|caf[eé]|bar|pub|brewery|bakery|dessert|ice cream|pizzeria|pizza|burger|tea house|diner|fast food|bistro|snack|juice bar/i;

export function isFoursquareConfigured() {
  return Boolean(process.env.FOURSQUARE_API_KEY?.trim());
}

export function foursquarePriceLabel(level) {
  return PRICE_LABELS.get(Number(level)) || null;
}

function categoryLabel(categories = []) {
  const category = categories.find((item) => item?.name)?.name;
  if (!category) return "Restaurante";
  const value = category.toLocaleLowerCase("en-US");
  const translations = [
    [/japanese|sushi|ramen/, "Japonesa"], [/italian|pizza/, "Italiana"],
    [/brazilian|botequim|churrasc/, "Brasileira"], [/middle eastern|arab|lebanese/, "Árabe"],
    [/hamburger|burger/, "Hambúrguer"], [/vegetarian|vegan/, "Vegetariana"],
    [/chinese|dim sum/, "Chinesa"], [/mexican|taco/, "Mexicana"],
    [/indian|curry/, "Indiana"], [/mediterranean|greek|turkish/, "Mediterrânea"],
    [/coffee|café|cafeteria/, "Cafeteria"], [/bar|pub|brewery/, "Bar"]
  ];
  return translations.find(([pattern]) => pattern.test(value))?.[1] || category;
}

function isDiningPlace(categories = []) {
  return Array.isArray(categories) && categories.some((category) =>
    typeof category?.name === "string" && DINING_CATEGORY.test(category.name)
  );
}

function photoUrl(photo) {
  if (!photo?.prefix || !photo?.suffix) return null;
  const source = `${photo.prefix}300x300${photo.suffix}`;
  return `/api/foursquare/photo?url=${encodeURIComponent(source)}`;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch { return null; }
}

export function parseFoursquarePhotoUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.hostname !== "fastly.4sqi.net" || (url.port && url.port !== "443") || url.username || url.password || !url.pathname.startsWith("/img/")) return null;
    return url;
  } catch { return null; }
}

function mapPlace(place, origin) {
  const fsqId = String(place?.fsq_place_id || "");
  const name = typeof place?.name === "string" ? place.name.trim() : "";
  const lat = Number(place?.latitude);
  const lng = Number(place?.longitude);
  if (!fsqId || !name || place?.latitude == null || place?.longitude == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const location = place.location || {};
  const address = location.formatted_address || [location.address, location.locality, location.region, location.postcode].filter(Boolean).join(", ");
  const menuUrl = safeUrl(place.menu);
  const websiteUrl = safeUrl(place.website);
  const sourceUrl = `https://foursquare.com/placemakers/review-place/${encodeURIComponent(fsqId)}`;
  const photo = Array.isArray(place.photos) ? place.photos.map(photoUrl).find(Boolean) : null;
  const blockedFlags = new Set(["closed", "delete", "privatevenue", "doesnt_exist", "inappropriate"]);
  const flags = Array.isArray(place.unresolved_flags) ? place.unresolved_flags : [];
  if (!isDiningPlace(place.categories) || place.date_closed || flags.some((flag) => blockedFlags.has(String(flag).toLowerCase()))) return null;

  return {
    id: `fsq:${fsqId}`,
    fsq_place_id: fsqId,
    name,
    slug: fsqId,
    cuisine: categoryLabel(place.categories),
    description: typeof place.description === "string" ? place.description.trim() : "",
    price_per_person: null,
    price_level: Number.isInteger(Number(place.price)) && Number(place.price) >= 1 && Number(place.price) <= 4 ? Number(place.price) : null,
    price_level_label: foursquarePriceLabel(place.price),
    rating: Number.isFinite(Number(place.rating)) && place.rating != null ? Number(place.rating) : null,
    rating_count: Number.isFinite(Number(place.stats?.total_ratings)) && place.stats?.total_ratings != null ? Number(place.stats.total_ratings) : null,
    address: address || "Endereço não informado",
    city: location.locality || "São Paulo",
    state: location.region || "SP",
    lat,
    lng,
    distance_km: place.distance != null && Number.isFinite(Number(place.distance)) ? Number(place.distance) / 1000 : origin ? distanceKm(origin.lat, origin.lng, lat, lng) : null,
    tags: Array.isArray(place.tastes) ? place.tastes.filter((tag) => typeof tag === "string").slice(0, 8) : [],
    image_url: photo,
    image_attribution: photo ? "Foursquare" : null,
    image_source_url: photo ? sourceUrl : null,
    menu_url: menuUrl,
    price_source_url: null,
    website_url: websiteUrl,
    is_demo: false,
    source: "foursquare",
    source_url: sourceUrl,
    verified_at: null,
    source_updated_at: place.date_refreshed || null,
    open_now: typeof place.hours?.open_now === "boolean" ? place.hours.open_now : null
  };
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function searchFoursquarePlaces(filters = {}) {
  const apiKey = process.env.FOURSQUARE_API_KEY?.trim();
  if (!apiKey) throw new Error("A busca do Foursquare não está configurada.");

  const params = new URLSearchParams();
  const cuisine = filters.cuisine ? CUISINE_QUERIES.get(String(filters.cuisine).trim().toLocaleLowerCase("pt-BR")) || filters.cuisine : "";
  const search = [cuisine, filters.q].filter(Boolean).join(" ").trim();
  params.set("query", search || "restaurant");
  params.set("limit", String(Math.min(Math.max(Number(filters.limit) || 50, 1), 50)));
  params.set("sort", search ? "RELEVANCE" : filters.lat != null && filters.lng != null ? "DISTANCE" : "POPULARITY");
  if (filters.lat != null && filters.lng != null) {
    params.set("ll", `${filters.lat},${filters.lng}`);
    params.set("radius", String(Math.min(Math.max(Math.round((Number(filters.radiusKm) || 45) * 1000), 1000), 100000)));
  } else {
    params.set("near", String(filters.near || "São Paulo, SP").trim().slice(0, 120));
  }
  if (filters.maxPriceLevel != null) {
    params.set("max_price", String(Math.min(Math.max(Number(filters.maxPriceLevel), 1), 4)));
  }

  let response;
  try {
    response = await fetch(`${API_URL}?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}`, "X-Places-Api-Version": API_VERSION, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
  } catch (error) {
    console.error("Foursquare request failed:", error.name);
    const failure = new Error("A busca de restaurantes está temporariamente indisponível.");
    failure.status = 502;
    throw failure;
  }

  if (!response.ok) {
    console.error("Foursquare returned HTTP", response.status);
    const message = response.status === 429
      ? "A busca atingiu o limite de chamadas. Tente novamente mais tarde."
      : "A fonte de restaurantes recusou a busca. Confira a chave do Foursquare.";
    const failure = new Error(message);
    failure.status = response.status === 429 ? 429 : 502;
    failure.publicMessage = message;
    throw failure;
  }

  const payload = await response.json();
  const origin = filters.lat != null && filters.lng != null ? { lat: Number(filters.lat), lng: Number(filters.lng) } : null;
  return (Array.isArray(payload.results) ? payload.results : []).map((place) => mapPlace(place, origin)).filter(Boolean);
}

