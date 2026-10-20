import { createClient } from "@supabase/supabase-js";
import { googleEnterpriseFieldsEnabled, isGooglePlacesConfigured, searchGooglePlaces } from "./google-places.js";
import { isFoursquareConfigured, searchFoursquarePlaces } from "./foursquare.js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
let currentDataMode = supabase ? "openstreetmap" : "not_configured";

export async function searchRestaurants(filters = {}) {
  if (isGooglePlacesConfigured()) return searchGooglePlaces(filters);
  if (isFoursquareConfigured()) return { items: await searchFoursquarePlaces(filters), nextPageToken: null };
  if (!supabase) {
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
  if (isGooglePlacesConfigured()) return "google";
  return isFoursquareConfigured() ? "foursquare" : currentDataMode;
}

export async function isGoogleEnterpriseEnabled() {
  return isGooglePlacesConfigured() && googleEnterpriseFieldsEnabled();
}

