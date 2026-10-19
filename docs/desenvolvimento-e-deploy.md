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

Depois, execute manualmente a importação documentada em [Dados e importação](dados-e-importacao.md).

## Render

O serviço web atual está em [onde-vamos-comer.onrender.com](https://onde-vamos-comer.onrender.com/). Ele usa um único processo Node para servir os arquivos estáticos e a API.

- **Build command:** `npm ci && npm run build`
- **Start command:** `npm start`
- **Runtime:** Node.js 22.12 ou superior
- **Variáveis de produção:** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `FOURSQUARE_API_KEY` para a busca ao vivo e, opcionalmente, `OPENAI_API_KEY`, `OPENAI_MODEL` e `WEB_ORIGIN`.
- **Não adicione** `SUPABASE_SERVICE_ROLE_KEY` ao serviço web.
- Configure `FOURSQUARE_API_KEY` como segredo no Render. A busca ao vivo só é ativada quando a variável existe; resultados não são persistidos.

O Render injeta `PORT`. Como o app e a API usam a mesma origem, `WEB_ORIGIN` não é necessário no deploy atual. Configure-o se a API passar a aceitar chamadas do front-end em outro domínio. Para desenvolvimento local, o padrão é `http://localhost:5173`.

## Verificações do repositório

- `npm run check:api` executa `node --check` nos módulos da API e importador.
- `npm test` exercita a integração Foursquare com respostas simuladas e valida URLs aceitas pelo proxy de fotos.
- `npm run build` executa a verificação acima e compila o Vue/Vite para `apps/web/dist`.
- Os testes não fazem chamadas externas nem validam uma chave real.

Após alteração de interface, revisar em viewport desktop e em pelo menos 390×844 e 320×740. Antes de publicar mudanças de código, executar `npm run build` e validar a busca, filtros, localização, favoritos, detalhes e paginação no deploy de preview ou produção.
