import test from "node:test";
import assert from "node:assert/strict";
import { distanceKm, mapCuratedRestaurant } from "../apps/api/src/restaurants.js";

function restaurant(overrides = {}) {
  return {
    id: "restaurant-id",
    slug: "restaurante-exemplo",
    name: "Restaurante Exemplo",
    cuisine: "Brasileira",
    description: "Restaurante de exemplo com culinária brasileira e pratos tradicionais.",
    description_source_url: "https://example.org/about",
    address: "Rua Exemplo, 10, São Paulo - SP",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
    lat: null,
    lng: null,
    price_per_person: null,
    price_basis: "menu_items_only",
    menu_url: "https://example.org/menu",
    price_source_url: "https://example.org/menu",
    website_url: "https://example.org",
    source_url: "https://example.org",
    verified_at: "2026-10-20T12:00:00.000Z",
    updated_at: "2026-10-20T12:00:00.000Z",
    curated_restaurant_photos: [
      { id: "secondary", image_url: "https://example.org/secondary.jpg", is_primary: false, attribution: "Autor / CC BY 4.0", source_page_url: "https://example.org/photo", license_name: "CC BY 4.0", license_url: "https://creativecommons.org/licenses/by/4.0/" },
      { id: "primary", image_url: "https://example.org/primary.jpg", is_primary: true, attribution: "Fotógrafa / CC BY 4.0", source_page_url: "https://example.org/photo-primary", license_name: "CC BY 4.0", license_url: "https://creativecommons.org/licenses/by/4.0/" }
    ],
    curated_menu_items: [
      { id: "dish", name: "Prato feito", price_brl: "35.00", price_basis: "portion", service_mode: "dine_in", price_status: "historical", source_url: "https://example.org/menu", source_checked_at: "2025-10-20T12:00:00.000Z" },
      { id: "combo", name: "Combo almoço", price_brl: "45.00", price_basis: "combo", service_mode: "delivery", price_status: "needs_confirmation", source_url: "https://example.org/menu", source_checked_at: "2026-10-20T12:00:00.000Z" }
    ],
    ...overrides
  };
}

test("curated records keep menu item prices separate from spend per person", () => {
  const mapped = mapCuratedRestaurant(restaurant());

  assert.equal(mapped.price_per_person, null);
  assert.equal(mapped.price_basis, "menu_items_only");
  assert.equal(mapped.menu_price_min, 35);
  assert.equal(mapped.menu_price_max, 45);
  assert.equal(mapped.menu_prices_need_confirmation, true);
  assert.equal(mapped.image_url, "https://example.org/primary.jpg");
  assert.equal(mapped.image_alt, "Imagem associada à ficha de Restaurante Exemplo");
  assert.equal(mapped.lat, null);
  assert.equal(mapped.distance_km, null);
});

test("only a current per-person menu item can supply a per-person price", () => {
  const mapped = mapCuratedRestaurant(restaurant({
    curated_menu_items: [
      { id: "per-person", name: "Almoço por pessoa", price_brl: "72.50", price_basis: "per_person", price_status: "current", source_url: "https://example.org/menu", source_checked_at: "2026-10-20T12:00:00.000Z" },
      { id: "historical-per-person", name: "Preço antigo", price_brl: "50.00", price_basis: "per_person", price_status: "historical", source_url: "https://example.org/menu", source_checked_at: "2025-10-20T12:00:00.000Z" }
    ]
  }));

  assert.equal(mapped.price_per_person, 72.5);
  assert.equal(mapped.price_basis, "per_person");
});

test("distance calculation returns a stable straight-line distance in kilometers", () => {
  const km = distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
  assert.ok(Math.abs(km - 111.195) < 0.02);
});
