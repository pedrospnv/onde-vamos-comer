# Desenvolvimento e deploy

## Ambiente local

1. Instale Node.js 22.12+.
2. Instale dependências com `npm ci`.
3. Copie `.env.example` para `.env` e configure a URL e a chave publishable do Supabase.
4. Inicie com `npm run dev`.

O front-end fica em `http://localhost:5173`; a API, em `http://localhost:3000`. O Vite faz proxy das chamadas `/api` para Express. Sem credenciais válidas do Supabase, a busca não retorna lugares.

## Banco novo

Aplique as migrações em ordem cronológica:

1. `202610170001_initial_schema.sql`
2. `202610180001_restaurant_search_pagination.sql`
3. `20261018114537_verified_restaurants_only.sql`
4. `20261020212737_curated_restaurant_catalog.sql`

O catálogo curado é criado e semeado pela quarta migração. O importador OSM é separado e opcional; veja [Dados e curadoria](dados-e-importacao.md).

## Render

O serviço web atual está em [onde-vamos-comer.onrender.com](https://onde-vamos-comer.onrender.com/). Ele usa um único processo Node para servir os arquivos estáticos e a API.

- **Build command:** `npm ci && npm run build`
- **Start command:** `npm start`
- **Runtime:** Node.js 22.12 ou superior
- **Variáveis de produção:** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `RESTAURANT_DATA_SOURCE=curated`. Foursquare e Google só são chamados quando sua fonte é explicitamente selecionada; também exigem suas chaves. Google ainda exige `GOOGLE_PLACES_ENABLED=true`. `OPENAI_API_KEY` é opcional e não é necessária para buscar dados. `WEB_ORIGIN` só é necessário se o front-end mudar de domínio.
- **Não adicione** `SUPABASE_SERVICE_ROLE_KEY` ao serviço web.
- Não configure uma chave Google no Render se a intenção é manter a integração desligada. Uma chave sozinha não ativa chamadas; elas só ocorrem com `GOOGLE_PLACES_ENABLED=true`. O Google Places exige faturamento ativo e pode gerar custos.
- Para habilitar avaliações e faixa geral de preço, defina `GOOGLE_PLACES_INCLUDE_ENTERPRISE_FIELDS=true` somente após conferir os custos e cotas do Google Cloud. Fotos não estão habilitadas nesta integração.

O Render injeta `PORT`. Como o app e a API usam a mesma origem, `WEB_ORIGIN` não é necessário no deploy atual. Configure-o se a API passar a aceitar chamadas do front-end em outro domínio. Para desenvolvimento local, o padrão é `http://localhost:5173`.

## Verificações do repositório

- `npm run check:api` executa `node --check` nos módulos da API e importador.
- `npm test` exercita mapeamento do catálogo, cálculo de distância e integrações Google Places/Foursquare com respostas simuladas.
- `npm run build` executa a verificação acima e compila o Vue/Vite para `apps/web/dist`.
- Os testes não fazem chamadas externas nem validam uma chave real.

Após alteração de interface, revisar em viewport desktop e em pelo menos 390×844 e 320×740. Antes de publicar mudanças de código, executar `npm run build` e validar a busca, filtros, localização, favoritos, detalhes e paginação no deploy de preview ou produção.
