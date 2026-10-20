import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { parseFoursquarePhotoUrl, searchFoursquarePlaces } from "../apps/api/src/foursquare.js";

const originalKey = process.env.FOURSQUARE_API_KEY;
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;

afterEach(() => {
  if (originalKey === undefined) delete process.env.FOURSQUARE_API_KEY;
  else process.env.FOURSQUARE_API_KEY = originalKey;
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
});

test("requires a server-side Foursquare key", async () => {
  delete process.env.FOURSQUARE_API_KEY;
  await assert.rejects(searchFoursquarePlaces(), /não está configurada/i);
});

test("photo proxy only accepts the official Foursquare image host and path", () => {
  assert.equal(parseFoursquarePhotoUrl("https://fastly.4sqi.net/img/general/photo.jpg")?.hostname, "fastly.4sqi.net");
  assert.equal(parseFoursquarePhotoUrl("https://evil.4sqi.net/img/general/photo.jpg"), null);
  assert.equal(parseFoursquarePhotoUrl("https://fastly.4sqi.net/redirect"), null);
  assert.equal(parseFoursquarePhotoUrl("http://fastly.4sqi.net/img/general/photo.jpg"), null);
});

test("maps live results to display data and sends bounded, non-cached search", async () => {
  process.env.FOURSQUARE_API_KEY = "test-key-do-not-use";
  let requestedUrl;
  let requestOptions;
  globalThis.fetch = async (url, options) => {
    requestedUrl = new URL(url);
    requestOptions = options;
    return new Response(JSON.stringify({ results: [
      {
        fsq_place_id: "place-123",
        name: "Restaurante de teste",
        latitude: -23.56,
        longitude: -46.66,
        price: 2,
        rating: 8.6,
        stats: { total_ratings: 25 },
        distance: 1500,
        categories: [{ name: "Japanese Restaurant" }],
        location: { formatted_address: "São Paulo, SP", locality: "São Paulo", region: "SP" },
        menu: "https://example.org/menu",
        website: "https://example.org",
        photos: [{ prefix: "https://fastly.4sqi.net/img/general/", suffix: "photo.jpg" }]
      },
      {
        fsq_place_id: "mall-123",
        name: "Shopping Center",
        latitude: -23.56,
        longitude: -46.66,
        categories: [{ name: "Shopping Mall" }],
        location: { locality: "São Paulo", region: "SP" }
      },
      { fsq_place_id: "closed-123", name: "Fechado", latitude: -23.5, longitude: -46.6, date_closed: "2025-01-01" }
    ] }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const places = await searchFoursquarePlaces({
    cuisine: "Japonesa", q: "Pinheiros", lat: -23.56, lng: -46.66, radiusKm: 15,
    maxPriceLevel: 2, limit: 200
  });

  assert.equal(requestedUrl.pathname, "/places/search");
  assert.equal(requestedUrl.searchParams.get("query"), "Japanese restaurant Pinheiros");
  assert.equal(requestedUrl.searchParams.get("max_price"), "2");
  assert.equal(requestedUrl.searchParams.get("limit"), "50");
  assert.equal(requestedUrl.searchParams.get("sort"), "RELEVANCE");
  assert.equal(requestedUrl.searchParams.get("radius"), "15000");
  assert.equal(requestOptions.cache, "no-store");
  assert.equal(requestOptions.headers.Authorization, "Bearer test-key-do-not-use");
  assert.equal(requestOptions.headers["X-Places-Api-Version"], "2025-06-17");
  assert.equal(places.length, 1);
  assert.equal(places[0].cuisine, "Japonesa");
  assert.equal(places[0].price_level, 2);
  assert.equal(places[0].price_level_label, "Moderado");
  assert.equal(places[0].price_per_person, null);
  assert.equal(places[0].rating, 8.6);
  assert.equal(places[0].rating_count, 25);
  assert.equal(places[0].distance_km, 1.5);
  assert.match(places[0].image_url, /^\/api\/foursquare\/photo\?/);
  assert.equal(places[0].verified_at, null);
});

test("accepts a selected city when no device coordinates are shared", async () => {
  process.env.FOURSQUARE_API_KEY = "test-key-do-not-use";
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = new URL(url);
    return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "content-type": "application/json" } });
  };

  await searchFoursquarePlaces({ near: "Campinas, SP" });

  assert.equal(requestedUrl.searchParams.get("near"), "Campinas, SP");
  assert.equal(requestedUrl.searchParams.get("sort"), "POPULARITY");
  assert.equal(requestedUrl.searchParams.has("ll"), false);
});

test("surfaces rate limiting without exposing provider response details", async () => {
  process.env.FOURSQUARE_API_KEY = "test-key-do-not-use";
  console.error = () => {};
  globalThis.fetch = async () => new Response("limited", { status: 429 });
  await assert.rejects(searchFoursquarePlaces(), (error) => error.status === 429 && /limite/i.test(error.message));
});

