import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const endpoint = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const relationAreaId = "3600298285"; // OpenStreetMap relation 298285: municipality of São Paulo.
const syncStartedAt = new Date().toISOString();
const exportPath = process.argv[2] === "--export-json" ? process.argv[3] : null;
const query = `[out:json][timeout:180];area(${relationAreaId})->.city;(nwr["amenity"~"^(restaurant|fast_food|cafe|bar|pub|ice_cream)$"](area.city););out center tags;`;

const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;
if (process.argv[2] === "--export-json" && !exportPath) {
  throw new Error("Informe o caminho para salvar o JSON após --export-json.");
}
if (!exportPath && !supabase) {
  throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente antes de importar.");
}

const cuisineGroups = [
  ["Japonesa", /japan|sushi|ramen|izakaya|teppanyaki|sashimi/i],
  ["Italiana", /italian|pizza|pasta|pizzeria/i],
  ["Brasileira", /brazil|brasil|churrasc|mineir|baiana|feijoada/i],
  ["Árabe", /arab|leban|syrian|middle eastern|falafel|shawarma/i],
  ["Hambúrguer", /burger|hamburg/i],
  ["Vegetariana", /vegetarian|vegan/i],
  ["Chinesa", /chinese|chines/i],
  ["Mexicana", /mexican|taco|burrito/i],
  ["Indiana", /indian|curry/i],
  ["Mediterrânea", /mediterranean|greek|turkish/i],
  ["Cafeteria", /coffee|cafe|tea/i],
  ["Bar", /pub|bar|brewery|beer/i]
];

function safeWebsite(value) {
  if (!value) return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

function mapCuisine(tags) {
  const raw = [tags.cuisine, tags.amenity].filter(Boolean).join(" ");
  return cuisineGroups.find(([, pattern]) => pattern.test(raw))?.[0] || "Não informada";
}

function toRestaurant(element) {
  const tags = element.tags || {};
  const name = tags["name:pt"] || tags.name;
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const externalId = `${element.type}/${element.id}`;
  const cuisineTags = (tags.cuisine || "").split(/[;,]/).map((tag) => tag.trim()).filter(Boolean);
  const placeTags = [...new Set([
    ...cuisineTags,
    tags.amenity,
    tags["diet:vegetarian"] === "yes" ? "vegetariano" : null,
    tags["diet:vegan"] === "yes" ? "vegano" : null,
    tags.takeaway === "yes" ? "retirada" : null,
    tags.delivery === "yes" ? "entrega" : null
  ].filter(Boolean))];
  const addressParts = [
    [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(", "),
    tags["addr:neighbourhood"] || tags["addr:suburb"],
    "São Paulo - SP"
  ].filter(Boolean);

  return {
    name,
    slug: `osm-${element.type}-${element.id}`,
    cuisine: mapCuisine(tags),
    description: tags.description || "Informações de localização mapeadas pela comunidade OpenStreetMap.",
    price_per_person: null,
    rating: null,
    rating_count: null,
    address: addressParts.join(", "),
    city: "São Paulo",
    state: "SP",
    location: { type: "Point", coordinates: [lng, lat] },
    tags: placeTags,
    website_url: safeWebsite(tags.website || tags["contact:website"]),
    source: "openstreetmap",
    external_id: externalId,
    source_url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    last_synced_at: syncStartedAt,
    status: "published",
    is_demo: false,
    updated_at: syncStartedAt
  };
}

async function fetchPlaces() {
  const body = new URLSearchParams({ data: query });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent": "OndeVamosComer/1.0 (https://github.com/pedrospnv/onde-vamos-comer)"
    },
    body,
    signal: AbortSignal.timeout(210_000)
  });
  if (!response.ok) throw new Error(`Overpass respondeu HTTP ${response.status}. Tente novamente mais tarde.`);
  const data = await response.json();
  if (!Array.isArray(data.elements)) throw new Error("Resposta inválida da consulta OpenStreetMap.");
  return data.elements.map(toRestaurant).filter(Boolean);
}

async function upsertInBatches(restaurants) {
  const batchSize = 500;
  for (let start = 0; start < restaurants.length; start += batchSize) {
    const { error } = await supabase.from("restaurants").upsert(restaurants.slice(start, start + batchSize), {
      onConflict: "source,external_id"
    });
    if (error) throw new Error(`Falha ao salvar registros do lote ${Math.floor(start / batchSize) + 1}: ${error.message}`);
  }
}

const restaurants = await fetchPlaces();
if (restaurants.length === 0) throw new Error("A consulta não retornou restaurantes; nenhum registro existente foi alterado.");
if (exportPath) {
  await writeFile(exportPath, JSON.stringify(restaurants), "utf8");
  console.log(JSON.stringify({ exported: restaurants.length, updatedAt: syncStartedAt }));
} else {
  await upsertInBatches(restaurants);

  const { error: staleError, count } = await supabase.from("restaurants")
    .update({ status: "draft", updated_at: syncStartedAt }, { count: "exact" })
    .eq("source", "openstreetmap")
    .eq("status", "published")
    .lt("last_synced_at", syncStartedAt);
  if (staleError) throw new Error(`Registros foram atualizados, mas a limpeza de locais ausentes falhou: ${staleError.message}`);

  console.log(JSON.stringify({ imported: restaurants.length, retired: count || 0, updatedAt: syncStartedAt }));
}
