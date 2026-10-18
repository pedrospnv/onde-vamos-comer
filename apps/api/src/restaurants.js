import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
let currentDataMode = supabase ? "openstreetmap" : "not_configured";

export async function searchRestaurants(filters = {}) {
  if (!supabase) {
    currentDataMode = "not_configured";
    return [];
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
  return data || [];
}

export async function dataMode() {
  return currentDataMode;
}
