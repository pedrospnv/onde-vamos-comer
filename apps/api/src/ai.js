import { z } from "zod";

const cuisineTerms = [
  ["Japonesa", ["japonesa", "japonês", "japones", "sushi", "temaki", "ramen"]],
  ["Italiana", ["italiana", "italiano", "pizza", "massa", "macarrão"]],
  ["Brasileira", ["brasileira", "brasileiro", "caseira", "prato feito"]],
  ["Árabe", ["árabe", "arabe", "falafel", "homus"]],
  ["Hambúrguer", ["hambúrguer", "hamburguer", "burger"]],
  ["Vegetariana", ["vegetariana", "vegetariano", "vegana", "vegano"]],
  ["Chinesa", ["chinesa", "chines", "chinese"]],
  ["Mexicana", ["mexicana", "mexicano", "taco", "burrito"]],
  ["Indiana", ["indiana", "indiano", "curry"]],
  ["Mediterrânea", ["mediterrânea", "mediterranea", "grega", "turca"]],
  ["Cafeteria", ["cafeteria", "café", "cafe"]],
  ["Bar", ["bar", "pub", "cervejaria"]]
];

function hasWholeWord(text, word) {
  if (word === "bar") return new RegExp("(^|[^\\p{L}])bar($|[^\\p{L}])", "iu").test(text);
  return text.includes(word);
}

function removeCuisineTerm(text, word) {
  if (word === "bar") return text.replace(new RegExp("(^|[^\\p{L}])bar(?=$|[^\\p{L}])", "giu"), "$1 ");
  return text.replaceAll(word, " ");
}

function localInterpretation(message) {
  const text = message.toLocaleLowerCase("pt-BR");
  const price = text.match(/(?:até|ate|no máximo|maximo|menos de|abaixo de)\s*r?\$?\s*(\d{1,4}(?:[.,]\d{1,2})?)/i) || text.match(/r\$\s*(\d{1,4}(?:[.,]\d{1,2})?)/i);
  const cuisine = cuisineTerms.find((entry) => entry[1].some((word) => hasWholeWord(text, word)));
  let searchText = text;
  if (cuisine) for (const word of cuisine[1]) searchText = removeCuisineTerm(searchText, word);
  if (price) searchText = searchText.replace(price[0], " ");
  searchText = searchText.replace(/\b(comida|restaurante|restaurantes|em|no|na|de|do|da|perto|mim|aqui|com|uma|um|pra|para|pessoa|por|barato|barata|econômico|econômica|acessível|até|ate)\b/gi, " ")
    .replace(/r\$|\d+(?:[.,]\d+)?/gi, " ").replace(/\s+/g, " ").trim();
  return {
    cuisine: cuisine ? cuisine[0] : null,
    maxBudget: price ? Number(price[1].replace(",", ".")) : null,
    searchText: searchText || null,
    aiEnabled: false
  };
}

const filtersSchema = z.object({
  cuisine: z.string().trim().max(60).nullable(),
  maxBudget: z.number().positive().max(10000).nullable(),
  searchText: z.string().trim().max(120).nullable()
});

export async function interpretRequest(message) {
  if (!process.env.OPENAI_API_KEY) return localInterpretation(message);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          { role: "system", content: "Extraia filtros de busca de restaurantes de uma mensagem em português. Não recomende lugares nem invente dados. Use null quando não houver filtro explícito. Em searchText, mantenha bairro, prato ou nome pesquisado que não esteja representado por cuisine ou maxBudget." },
          { role: "user", content: message }
        ],
        text: { format: { type: "json_schema", name: "restaurant_filters", strict: true, schema: {
          type: "object", additionalProperties: false,
          properties: {
            cuisine: { type: ["string", "null"] },
            maxBudget: { type: ["number", "null"] },
            searchText: { type: ["string", "null"] }
          },
          required: ["cuisine", "maxBudget", "searchText"]
        } } },
        max_output_tokens: 120
      })
    });
    if (!response.ok) throw new Error("OpenAI API status " + response.status);
    const data = await response.json();
    const text = data.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
    if (!text) throw new Error("Resposta estruturada ausente");
    const parsed = filtersSchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new Error("Filtros estruturados inválidos");
    return { ...parsed.data, aiEnabled: true };
  } catch (error) {
    console.error("Falha na interpretação por IA; usando filtros locais:", error.message);
    return localInterpretation(message);
  }
}
