# Arquitetura

## Visão geral

O front-end Vue é compilado pelo Vite e servido pelo mesmo processo Express que expõe a API. A busca de lugares e a leitura da base passam pelo servidor; o navegador não recebe a chave administrativa do Supabase.

```mermaid
flowchart LR
  U[Pessoa no navegador] -->|Vue e HTTPS| E[Express no Render]
  E -->|RPC search_restaurants| S[(Supabase Postgres + PostGIS)]
  E -->|busca ao vivo sem persistência| F[Foursquare Places API]
  E -->|busca ao vivo sem persistência| G[Google Places API]
  E -->|interpretação opcional| O[OpenAI Responses API]
  O -->|filtros estruturados| E
  E -->|resultados| U
  X[Importador local] -->|consulta| P[OpenStreetMap / Overpass]
  X -->|upsert com chave administrativa| S
  U -->|favoritos no dispositivo| L[localStorage]
```

## Componentes

### Front-end

- `apps/web/src/App.vue` contém a tela de busca, filtros, resultados, favoritos e detalhes.
- `apps/web/src/style.css` define cores, tipografia, componentes e pontos de quebra para telas pequenas, médias e grandes.
- `apps/web/index.html` define o idioma, metadados e fontes.
- O Vite encaminha `/api` para `http://localhost:3000` no desenvolvimento. Em produção, Express serve `apps/web/dist` e as rotas `/api` no mesmo domínio.

### API

- `apps/api/src/server.js` configura Express, Helmet, CORS, limites de requisição, validação de entradas e endpoints.
- `apps/api/src/restaurants.js` prioriza Google Places quando `GOOGLE_PLACES_API_KEY` existe; usa Foursquare como reserva e Supabase quando nenhuma fonte externa está configurada.
- `apps/api/src/foursquare.js` normaliza os resultados temporários da API externa.
- `apps/api/src/google-places.js` consulta e normaliza os resultados do Google Places sem armazená-los.
- `apps/api/src/ai.js` extrai culinária, orçamento e texto livre. Usa regras locais se a chave da OpenAI não estiver configurada ou se a chamada falhar.
- O modelo não escolhe nem inventa restaurantes. A lista vem do Supabase ou da fonte externa ativa.

### Banco de dados

- `public.restaurants` guarda os lugares, coordenadas PostGIS, metadados da fonte e estado de publicação.
- RLS permite leitura anônima apenas de restaurantes publicados, completos e verificados nos últimos 180 dias.
- A função `public.search_restaurants` aplica os mesmos critérios, além de filtros textuais, geográficos, de culinária e orçamento e paginação.
- A chave `SUPABASE_SERVICE_ROLE_KEY` só é necessária no script de importação e não deve ser colocada no serviço web.

## Fluxo da busca

1. A tela envia os filtros para `GET /api/restaurants` ou a frase para `POST /api/recommend`.
2. A API valida os dados e, se necessário, interpreta a frase.
3. A API consulta Google Places em tempo real, Foursquare como reserva, ou chama `search_restaurants` no Supabase.
4. O PostGIS calcula a distância quando latitude e longitude foram fornecidas.
5. Nas fontes externas, a interface identifica o provedor e mantém o preço por pessoa vazio; no modo Supabase, aplica a curadoria dos dados próprios.

Ao selecionar **Alterar**, o navegador solicita permissão de localização. Se autorizada, as coordenadas são usadas na busca ao vivo; o app não as grava. A pessoa também pode digitar uma cidade ou bairro nos filtros. Favoritos próprios ficam no `localStorage`; favoritos das fontes externas permanecem apenas na sessão.

## Segurança e privacidade

- A chave administrativa do Supabase fica fora do front-end e fora do deploy web.
- A API valida parâmetros com Zod e limita o tamanho do corpo JSON.
- Helmet adiciona cabeçalhos de segurança; CORS usa as origens configuradas em `WEB_ORIGIN`.
- A API limita chamadas gerais a 60 por minuto por origem e `/api/recommend` a 10 por minuto.
- Sem login, o app não mantém perfis ou favoritos em servidor.
- Se a integração OpenAI for habilitada, somente a frase digitada é enviada para extrair filtros. Coordenadas de localização são enviadas à API do próprio app para a busca geográfica, não à chamada da OpenAI.
- As chaves dos provedores permanecem no servidor. Respostas do Google e Foursquare são entregues com `Cache-Control: no-store`; as páginas `/privacidade` e `/termos` descrevem fontes, atribuição e tratamento dos dados.

