import { createClient } from "@supabase/supabase-js";
import { demoRestaurants } from "./demo-data.js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

function distanceKm(a, b, c, d) {
  const rad = (v) => v * Math.PI / 180;
  const x = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function localSearch(filters) {
  const cuisine = (filters.cuisine || "").toLocaleLowerCase("pt-BR");
  const query = (filters.q || "").toLocaleLowerCase("pt-BR");
  return demoRestaurants.filter((place) => {
    const text = [place.name, place.cuisine, place.description, ...place.tags].join(" ").toLocaleLowerCase("pt-BR");
    return (!cuisine || place.cuisine.toLocaleLowerCase("pt-BR").includes(cuisine))
      && (!query || text.includes(query))
      && (filters.maxBudget == null || place.price_per_person <= filters.maxBudget);
  }).map((place) => ({
    ...place,
    distance_km: filters.lat == null || filters.lng == null ? null : distanceKm(filters.lat, filters.lng, place.lat, place.lng)
  })).filter((place) => place.distance_km == null || place.distance_km <= (filters.radiusKm || 15))
    .sort((a, b) => b.rating - a.rating);
}

export async function searchRestaurants(filters = {}) {
  if (supabase) {
    const { data, error } = await supabase.rpc("search_restaurants", {
      p_cuisine: filters.cuisine || null,
      p_max_budget: filters.maxBudget || null,
      p_search: filters.q || null,
      p_lat: filters.lat ?? null,
      p_lng: filters.lng ?? null,
      p_radius_km: filters.radiusKm || 15,
      p_limit: 30
    });
    if (!error) return data || [];
    console.error("Busca Supabase falhou:", error.message);
    if (process.env.DEMO_MODE !== "true") throw new Error("Não foi possível consultar os restaurantes.");
  } else if (process.env.DEMO_MODE !== "true") {
    throw new Error("Configure Supabase URL e publishable key.");
  }
  return localSearch(filters);
}

export async function dataMode() {
  return supabase ? "supabase" : "demo";
}
