import { createClient } from "@supabase/supabase-js";
import { googleEnterpriseFieldsEnabled, isGooglePlacesConfigured, searchGooglePlaces } from "./google-places.js";
import { isFoursquareConfigured, searchFoursquarePlaces } from "./foursquare.js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
const configuredSource = (process.env.RESTAURANT_DATA_SOURCE || "curated").trim().toLowerCase();
let currentDataMode = configuredSource;
let googleRetryAfter = 0;

// Coordinates are tied to the published venue addresses. When Supabase rows
// later include their own coordinates, those values take precedence.
const CURATED_COORDINATES = {
  "mocoto-vila-clementino": { lat: -23.5983504, lng: -46.6409843 },
  "di-cunto-mooca": { lat: -23.5554802, lng: -46.6071916 },
  "bar-estadao": { lat: -23.5488002, lng: -46.6426171 },
  "famiglia-mancini-trattoria": { lat: -23.55037, lng: -46.64511 },
  "cantina-casteloes": { lat: -23.5444475, lng: -46.6214891 }
};

export function distanceKm(origin, destination) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(destination.lat - origin.lat);
  const longitudeDelta = radians(destination.lng - origin.lng);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(origin.lat)) * Math.cos(radians(destination.lat))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function mapCuratedRestaurant(row, origin = null) {
  const photos = Array.isArray(row.curated_restaurant_photos) ? row.curated_restaurant_photos : [];
  const menuItems = Array.isArray(row.curated_menu_items) ? row.curated_menu_items : [];
  const photo = photos.find((item) => item.is_primary) || photos[0] || null;
  const eligiblePerPerson = menuItems.filter((item) => item.price_basis === "per_person" && item.price_status === "current");
  const perPersonPrice = row.price_basis === "per_person" && row.price_per_person != null
    ? Number(row.price_per_person)
    : eligiblePerPerson.length
      ? Math.min(...eligiblePerPerson.map((item) => Number(item.price_brl)))
      : null;
  const listedPrices = menuItems.map((item) => Number(item.price_brl)).filter(Number.isFinite);
  const fallbackCoordinates = CURATED_COORDINATES[row.slug];
  const coordinates = row.lat != null && row.lng != null
    ? { lat: Number(row.lat), lng: Number(row.lng) }
    : fallbackCoordinates || null;
  return {
    id: `curated:${row.id}`,
    slug: row.slug,
    name: row.name,
    cuisine: row.cuisine,
    description: row.description,
    description_source_url: row.description_source_url,
    price_per_person: perPersonPrice,
    price_basis: perPersonPrice == null ? "menu_items_only" : "per_person",
    menu_price_min: listedPrices.length ? Math.min(...listedPrices) : null,
    menu_price_max: listedPrices.length ? Math.max(...listedPrices) : null,
    menu_prices_need_confirmation: menuItems.some((item) => item.price_status !== "current"),
    price_level: null,
    price_level_label: null,
    rating: null,
    rating_count: null,
    address: row.address,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    lat: coordinates?.lat ?? null,
    lng: coordinates?.lng ?? null,
    distance_km: origin && coordinates ? distanceKm(origin, coordinates) : null,
    tags: [],
    image_url: photo?.image_url || null,
    image_alt: `Imagem associada à ficha de ${row.name}`,
    image_attribution: photo?.attribution || null,
    image_source_url: photo?.source_page_url || null,
    image_license: photo?.license_name || null,
    image_license_name: photo?.license_name || null,
    image_license_url: photo?.license_url || null,
    menu_url: row.menu_url,
    menu_items: menuItems.sort((a, b) => Number(a.price_brl) - Number(b.price_brl)),
    price_source_url: row.price_source_url || menuItems[0]?.source_url || null,
    website_url: row.website_url,
    is_demo: false,
    source: "curated",
    source_url: row.source_url,
    verified_at: row.verified_at,
    source_updated_at: row.updated_at,
    open_now: null
  };
}

async function searchCuratedRestaurants(filters = {}) {
  if (!supabase) {
    currentDataMode = "not_configured";
    return { items: [], nextPageToken: null, total: 0 };
  }
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
  const offset = Math.min(Math.max(Number(filters.offset) || 0, 0), 10000);
  let query = supabase.from("curated_restaurants")
    .select("*, curated_restaurant_photos(*), curated_menu_items(*)", { count: "exact" })
    .eq("status", "published")
    .gte("verified_at", new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
    .order("name", { ascending: true });

  if (filters.cuisine) query = query.ilike("cuisine", `%${String(filters.cuisine).replace(/[%,()\\]/g, " ").trim()}%`);
  const searchTerm = String(filters.q || "").replace(/[^\p{L}\p{N}\s-]/gu, " ").trim().slice(0, 120);
  if (searchTerm) {
    const pattern = `%${searchTerm.replace(/[%_\\]/g, " ")}%`;
    query = query.or(`name.ilike.${pattern},cuisine.ilike.${pattern},neighborhood.ilike.${pattern},description.ilike.${pattern}`);
  }
  if (filters.near) {
    const locationTerms = String(filters.near)
      .split(",")
      .map((part) => part.trim().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " "))
      .filter((part) => part && !/^[A-Z]{2}$/i.test(part));
    for (const term of locationTerms) {
      query = query.or(`neighborhood.ilike.%${term}%,city.ilike.%${term}%`);
    }
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) {
    console.error("Busca do catálogo Supabase falhou:", error.message);
    throw new Error("Não foi possível consultar o catálogo de restaurantes.");
  }
  const lat = Number(filters.lat);
  const lng = Number(filters.lng);
  const origin = filters.lat != null && filters.lng != null
    && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng }
    : null;
  let items = (data || []).map((row) => mapCuratedRestaurant(row, origin));
  if (origin) items.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
  if (filters.maxBudget != null) {
    // Unknown per-person prices stay visible and are clearly called out by the UI.
    items = items.filter((item) => item.price_per_person == null || item.price_per_person <= Number(filters.maxBudget));
  }
  currentDataMode = "curated";
  return { items, nextPageToken: null, total: count || 0 };
}

export async function getCuratedRestaurant(slug) {
  if (!supabase) return null;
  const { data, error } = await supabase.from("curated_restaurants")
    .select("*, curated_restaurant_photos(*), curated_menu_items(*)")
    .eq("slug", slug)
    .eq("status", "published")
    .gte("verified_at", new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
    .maybeSingle();
  if (error) {
    console.error("Consulta de ficha Supabase falhou:", error.message);
    throw new Error("Não foi possível consultar este restaurante.");
  }
  return data ? mapCuratedRestaurant(data) : null;
}

export async function searchRestaurants(filters = {}) {
  if (configuredSource === "curated") return searchCuratedRestaurants(filters);

  if (configuredSource === "google" && isGooglePlacesConfigured() && Date.now() >= googleRetryAfter) {
    try {
      const result = await searchGooglePlaces(filters);
      currentDataMode = "google";
      return result;
    } catch (error) {
      console.error("Google Places indisponível; usando Foursquare como reserva.", error.status || error.name);
      googleRetryAfter = Date.now() + 5 * 60_000;
      if (configuredSource !== "foursquare" || !isFoursquareConfigured()) throw error;
    }
  }
  if (configuredSource === "foursquare" && isFoursquareConfigured()) {
    const items = await searchFoursquarePlaces(filters);
    currentDataMode = "foursquare";
    return { items, nextPageToken: null };
  }
  if (configuredSource !== "openstreetmap" || !supabase) {
    currentDataMode = "not_configured";
    return { items: [], nextPageToken: null };
  }

  const { data, error } = await supabase.rpc("search_restaurants", {
    p_cuisine: filters.cuisine || null,
    p_max_budget: filters.maxBudget ?? null,
    p_search: filters.q || null,
    p_lat: filters.lat ?? null,
    p_lng: filters.lng ?? null,
    p_radius_km: filters.radiusKm || 45,
    p_limit: filters.limit ?? 50,
    p_offset: filters.offset ?? 0
  });
  if (error) {
    console.error("Busca Supabase falhou:", error.message);
    throw new Error("Não foi possível consultar os restaurantes.");
  }

  currentDataMode = "openstreetmap";
  return { items: data || [], nextPageToken: null };
}

export async function dataMode() {
  if (configuredSource === "curated") return supabase ? "curated" : "not_configured";
  if (configuredSource === "google" && isGooglePlacesConfigured() && Date.now() >= googleRetryAfter) return "google";
  if (configuredSource === "foursquare" && isFoursquareConfigured()) return "foursquare";
  if (configuredSource === "openstreetmap" && supabase) return "openstreetmap";
  return currentDataMode;
}

export async function isGoogleEnterpriseEnabled() {
  return isGooglePlacesConfigured() && googleEnterpriseFieldsEnabled();
}
