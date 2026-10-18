const cuisineTerms = [
  ["Japonesa", ["japonesa", "japonês", "japones", "sushi", "temaki", "ramen"]],
  ["Italiana", ["italiana", "italiano", "pizza", "massa", "macarrão"]],
  ["Brasileira", ["brasileira", "brasileiro", "caseira", "prato feito"]],
  ["Árabe", ["árabe", "arabe", "falafel", "homus"]],
  ["Hambúrguer", ["hambúrguer", "hamburguer", "burger"]],
  ["Havaiana", ["havaiana", "poke"]],
  ["Vegetariana", ["vegetariana", "vegetariano", "vegana", "vegano"]]
];

function localInterpretation(message) {
  const text = message.toLocaleLowerCase("pt-BR");
  const price = text.match(/(?:até|ate|no máximo|maximo|menos de|abaixo de)\s*r?\$?\s*(\d{1,4}(?:[.,]\d{1,2})?)/i) || text.match(/r\$\s*(\d{1,4}(?:[.,]\d{1,2})?)/i);
  const cuisine = cuisineTerms.find((entry) => entry[1].some((word) => text.includes(word)));
  return {
    cuisine: cuisine ? cuisine[0] : null,
    maxBudget: price ? Number(price[1].replace(",", ".")) : null,
    searchText: !cuisine && !price ? message.trim() : null,
    aiEnabled: false
  };
}

export async function interpretRequest(message) {
  if (!process.env.OPENAI_API_KEY) return localInterpretation(message);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          { role: "system", content: "Extraia filtros de busca de restaurantes de uma mensagem em português. Não recomende lugares nem invente dados. Use null quando não houver filtro explícito." },
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
    return { ...JSON.parse(text), aiEnabled: true };
  } catch (error) {
    console.error("Falha na interpretação por IA; usando filtros locais:", error.message);
    return localInterpretation(message);
  }
}
