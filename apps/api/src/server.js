import "dotenv/config";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { interpretRequest } from "./ai.js";
import { dataMode, searchRestaurants } from "./restaurants.js";

const app = express();
const port = Number(process.env.PORT) || 3000;
const frontendDist = fileURLToPath(new URL("../../web/dist/", import.meta.url));
const apiLimit = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false });
const aiLimit = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });
const filtersSchema = z.object({
  cuisine: z.string().trim().max(60).optional().nullable(),
  maxBudget: z.coerce.number().positive().max(10000).optional().nullable(),
  q: z.string().trim().max(120).optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10000).optional(),
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
app.get("/api/meta", async (_req, res) => res.json({ dataMode: await dataMode(), aiEnabled: Boolean(process.env.OPENAI_API_KEY) }));

app.get("/api/restaurants", async (req, res, next) => {
  const parsed = filtersSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Filtros inválidos." });
  try {
    const items = await searchRestaurants(parsed.data);
    res.json({ items, count: items.length, dataMode: await dataMode() });
  } catch (error) { next(error); }
});

app.post("/api/recommend", aiLimit, async (req, res, next) => {
  const parsed = z.object({
    message: z.string().trim().min(3).max(500),
    maxBudget: z.coerce.number().positive().max(10000).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().min(1).max(100).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Escreva o que está procurando (até 500 caracteres)." });
  try {
    const filters = await interpretRequest(parsed.data.message);
    const items = await searchRestaurants({
      cuisine: filters.cuisine,
      maxBudget: filters.maxBudget ?? parsed.data.maxBudget,
      q: filters.searchText,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      radiusKm: parsed.data.radiusKm
    });
    res.json({ filters, items, count: items.length, dataMode: await dataMode() });
  } catch (error) { next(error); }
});

app.use(express.static(frontendDist));
app.get(/^(?!\/api).*/, (_req, res, next) => {
  res.sendFile(path.join(frontendDist, "index.html"), (error) => {
    if (error) next(error);
  });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  res.status(status).json({ error: status < 500 ? "Requisição inválida." : "Ocorreu um erro inesperado. Tente novamente." });
});

app.listen(port, "0.0.0.0", () => console.log("API disponível na porta " + port));
