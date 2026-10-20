import "dotenv/config";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { interpretRequest } from "./ai.js";
import { dataMode, isGoogleEnterpriseEnabled, searchRestaurants } from "./restaurants.js";
import { isGooglePlacesConfigured } from "./google-places.js";
import { isFoursquareConfigured, parseFoursquarePhotoUrl } from "./foursquare.js";

const app = express();
const port = Number(process.env.PORT) || 3000;
const frontendDist = fileURLToPath(new URL("../../web/dist/", import.meta.url));
app.set("trust proxy", 1);
const apiLimit = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false });
const aiLimit = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });
const restaurantSearchLimit = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });
const foursquarePhotoLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });
const filtersSchema = z.object({
  cuisine: z.string().trim().max(60).optional().nullable(),
  maxBudget: z.coerce.number().positive().max(10000).optional().nullable(),
  maxPriceLevel: z.coerce.number().int().min(1).max(4).optional().nullable(),
  q: z.string().trim().max(120).optional().nullable(),
  near: z.string().trim().max(120).optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10000).optional(),
  pageToken: z.string().trim().max(2048).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(100).optional()
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"]
    }
  }
}));
app.use(cors({ origin: (process.env.WEB_ORIGIN || "http://localhost:5173").split(",") }));
app.use(express.json({ limit: "20kb" }));
app.use("/api", apiLimit);
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/meta", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ dataMode: await dataMode(), aiEnabled: Boolean(process.env.OPENAI_API_KEY), foursquareEnabled: isFoursquareConfigured(), googlePlacesEnabled: isGooglePlacesConfigured(), googleEnterpriseFieldsEnabled: await isGoogleEnterpriseEnabled() });
});

app.get("/api/foursquare/photo", foursquarePhotoLimit, async (req, res, next) => {
  const imageUrl = parseFoursquarePhotoUrl(req.query.url);
  if (!imageUrl) {
    return res.status(400).json({ error: "Origem de imagem não permitida." });
  }
  try {
    const response = await fetch(imageUrl, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000) });
    const contentType = response.headers.get("content-type")?.split(";")[0].toLowerCase() || "";
    const maxBytes = 5 * 1024 * 1024;
    if (!response.ok || !/^image\/(jpeg|png|webp|gif)$/.test(contentType)) return res.status(502).end();
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) return res.status(413).end();
    const chunks = [];
    let totalBytes = 0;
    const reader = response.body?.getReader();
    if (!reader) return res.status(502).end();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return res.status(413).end();
      }
      chunks.push(Buffer.from(value));
    }
    const image = Buffer.concat(chunks, totalBytes);
    res.set({ "Cache-Control": "no-store", "Content-Type": contentType, "X-Content-Type-Options": "nosniff" });
    res.send(image);
  } catch (error) { next(error); }
});

app.get("/api/restaurants", restaurantSearchLimit, async (req, res, next) => {
  const parsed = filtersSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Filtros inválidos." });
  try {
    const result = await searchRestaurants(parsed.data);
    const items = result.items;
    const mode = await dataMode();
    res.set("Cache-Control", mode === "foursquare" || mode === "google" ? "no-store" : "private, no-cache");
    res.json({ items, count: items.length, hasMore: mode === "google" ? Boolean(result.nextPageToken) : mode === "foursquare" ? false : items.length === (parsed.data.limit ?? 50), nextPageToken: result.nextPageToken, dataMode: mode });
  } catch (error) { next(error); }
});

app.post("/api/recommend", aiLimit, async (req, res, next) => {
  const parsed = z.object({
    message: z.string().trim().min(3).max(500),
    maxBudget: z.coerce.number().positive().max(10000).optional(),
    maxPriceLevel: z.coerce.number().int().min(1).max(4).optional(),
    near: z.string().trim().max(120).optional().nullable(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().min(1).max(100).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Escreva o que está procurando (até 500 caracteres)." });
  try {
    const filters = await interpretRequest(parsed.data.message);
    const result = await searchRestaurants({
      cuisine: filters.cuisine,
      maxBudget: filters.maxBudget ?? parsed.data.maxBudget,
      maxPriceLevel: parsed.data.maxPriceLevel,
      q: filters.searchText,
      near: parsed.data.near,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      radiusKm: parsed.data.radiusKm
    });
    const items = result.items;
    const mode = await dataMode();
    res.set("Cache-Control", mode === "foursquare" || mode === "google" ? "no-store" : "private, no-cache");
    const budgetNotice = mode === "foursquare" && filters.maxBudget != null
      ? "A faixa de preço do Foursquare é geral e não equivale a um valor em reais por pessoa."
      : mode === "google" && filters.maxBudget != null
        ? "O Google não informa preço por pessoa em reais nesta configuração. Confira os valores no perfil ou cardápio do restaurante."
        : null;
    res.json({ filters, items, count: items.length, hasMore: mode === "google" ? Boolean(result.nextPageToken) : false, nextPageToken: result.nextPageToken, budgetNotice, dataMode: mode });
  } catch (error) { next(error); }
});

app.use(express.static(frontendDist));
app.get("/privacidade", (_req, res, next) => {
  res.sendFile(path.join(frontendDist, "privacidade.html"), (error) => {
    if (error) next(error);
  });
});
app.get("/termos", (_req, res, next) => {
  res.sendFile(path.join(frontendDist, "termos.html"), (error) => {
    if (error) next(error);
  });
});
app.get(/^(?!\/api).*/, (_req, res, next) => {
  res.sendFile(path.join(frontendDist, "index.html"), (error) => {
    if (error) next(error);
  });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  res.status(status).json({ error: status < 500 ? (error.publicMessage || "Requisição inválida.") : "Ocorreu um erro inesperado. Tente novamente." });
});

app.listen(port, "0.0.0.0", () => console.log("API disponível na porta " + port));

