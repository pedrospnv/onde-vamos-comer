import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { googleEnterpriseFieldsEnabled, isGooglePlacesConfigured, searchGooglePlaces } from "../apps/api/src/google-places.js";

const originalKey = process.env.GOOGLE_PLACES_API_KEY;
const originalEnterprise = process.env.GOOGLE_PLACES_INCLUDE_ENTERPRISE_FIELDS;
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;

afterEach(() => {
  if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = originalKey;
  if (originalEnterprise === undefined) delete process.env.GOOGLE_PLACES_INCLUDE_ENTERPRISE_FIELDS;
  else process.env.GOOGLE_PLACES_INCLUDE_ENTERPRISE_FIELDS = originalEnterprise;
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
});

test("requires a server-side Google Places key", async () => {
  delete process.env.GOOGLE_PLACES_API_KEY;
  assert.equal(isGooglePlacesConfigured(), false);
  await assert.rejects(searchGooglePlaces(), /Google Places não está configurada/i);
});

test("searches Google with a bounded, uncached basic field mask and maps places", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-key-do-not-use";
  delete process.env.GOOGLE_PLACES_INCLUDE_ENTERPRISE_FIELDS;
  let requestOptions;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://places.googleapis.com/v1/places:searchText");
    requestOptions = options;
    return new Response(JSON.stringify({
      places: [{
        id: "ChIJ-place-1",
        displayName: { text: "Sushi Exemplo" },
        formattedAddress: "Rua Exemplo, São Paulo - SP",
        location: { latitude: -23.56, longitude: -46.66 },
        primaryTypeDisplayName: { text: "Japanese restaurant" },
        types: ["restaurant", "food"],
        googleMapsUri: "https://maps.google.com/?cid=123",
        rating: 4.8,
        priceLevel: "PRICE_LEVEL_MODERATE"
      }],
      nextPageToken: "next-page"
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const result = await searchGooglePlaces({ cuisine: "Japonesa", near: "Pinheiros, São Paulo", limit: 70 });
  const body = JSON.parse(requestOptions.body);
  const fields = requestOptions.headers["X-Goog-FieldMask"];
  assert.equal(requestOptions.method, "POST");
  assert.equal(requestOptions.cache, "no-store");
  assert.equal(requestOptions.headers["X-Goog-Api-Key"], "test-key-do-not-use");
  assert.equal(body.textQuery, "Japanese restaurant in Pinheiros, São Paulo");
  assert.equal(body.pageSize, 20);
  assert.equal(body.includedType, "restaurant");
  assert.equal(fields.includes("places.rating"), false);
  assert.equal(fields.includes("places.priceLevel"), false);
  assert.equal(result.nextPageToken, "next-page");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, "google:ChIJ-place-1");
  assert.equal(result.items[0].cuisine, "Japonesa");
  assert.equal(result.items[0].price_level, null);
  assert.equal(result.items[0].rating, null);
  assert.equal(result.items[0].image_url, null);
  assert.equal(result.items[0].source, "google");
});

test("accepts a Google page token and location bias; optional Enterprise fields are explicit", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-key-do-not-use";
  process.env.GOOGLE_PLACES_INCLUDE_ENTERPRISE_FIELDS = "true";
  assert.equal(googleEnterpriseFieldsEnabled(), true);
  let requestOptions;
  globalThis.fetch = async (_url, options) => {
    requestOptions = options;
    return new Response(JSON.stringify({ places: [{
      id: "ChIJ-place-2", displayName: { text: "Bistrô Exemplo" },
      location: { latitude: -23.55, longitude: -46.63 },
      googleMapsUri: "https://maps.google.com/?cid=456",
      primaryTypeDisplayName: { text: "Restaurant" },
      priceLevel: "PRICE_LEVEL_MODERATE", rating: 4.6, userRatingCount: 42
    }] }), { status: 200 });
  };

  const result = await searchGooglePlaces({ pageToken: "next-page", lat: -23.55, lng: -46.63, radiusKm: 100, maxPriceLevel: 2 });
  const body = JSON.parse(requestOptions.body);
  assert.equal(body.pageToken, "next-page");
  assert.equal(body.locationBias.circle.radius, 50000);
  assert.match(requestOptions.headers["X-Goog-FieldMask"], /places\.rating/);
  assert.equal(result.items[0].price_level, 2);
  assert.equal(result.items[0].rating, 4.6);
  assert.equal(result.items[0].rating_count, 42);
  assert.equal(result.items.length, 1);
});

test("hides provider errors and reports throttling clearly", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-key-do-not-use";
  console.error = () => {};
  globalThis.fetch = async () => new Response("secret provider body", { status: 429 });
  await assert.rejects(searchGooglePlaces(), (error) => error.status === 429 && /limite/i.test(error.message) && !error.message.includes("secret"));
});

