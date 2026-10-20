import { createClient } from "@supabase/supabase-js";
import { googleEnterpriseFieldsEnabled, isGooglePlacesConfigured, searchGooglePlaces } from "./google-places.js";
import { isFoursquareConfigured, searchFoursquarePlaces } from "./foursquare.js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
let currentDataMode = supabase ? "openstreetmap" : "not_configured";
let googleRetryAfter = 0;

export async function searchRestaurants(filters = {}) {
  if (isGooglePlacesConfigured() && Date.now() >= googleRetryAfter) {
    try {
      const result = await searchGooglePlaces(filters);
      currentDataMode = "google";
      return result;
    } catch (error) {
      console.error("Google Places indisponível; usando Foursquare como reserva.", error.status || error.name);
      googleRetryAfter = Date.now() + 5 * 60_000;
      if (!isFoursquareConfigured()) throw error;
    }
  }
  if (isFoursquareConfigured()) {
    const items = await searchFoursquarePlaces(filters);
    currentDataMode = "foursquare";
    return { items, nextPageToken: null };
  }
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
  if (isGooglePlacesConfigured() && Date.now() >= googleRetryAfter) return "google";
  if (isFoursquareConfigured()) return "foursquare";
  return currentDataMode;
}

export async function isGoogleEnterpriseEnabled() {
  return isGooglePlacesConfigured() && googleEnterpriseFieldsEnabled();
}

