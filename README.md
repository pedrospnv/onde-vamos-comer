# Onde Vamos?

App demonstrativo que encontra restaurantes conforme a vontade, o orçamento por pessoa e a distância. Uma frase como “japonês até R$ 60 perto de mim” pode virar filtros de culinária, preço e localização.

**Aviso:** os restaurantes, preços, avaliações e coordenadas do conteúdo inicial são fictícios. Não use os dados para planejar uma visita; eles servem apenas para a demonstração.

## Stack

- Vue 3 + Vite no front-end
- Node.js + Express na API
- Supabase Postgres com PostGIS para os dados e busca geográfica
- OpenAI Responses API para interpretar pedidos em linguagem natural (opcional)

## Rodar localmente

Requer Node.js 22.12 ou superior.

    npm install
    Copy-Item .env.example .env
    npm run dev

A interface abre em http://localhost:5173 e a API em http://localhost:3000.

Sem credenciais, a app funciona em modo demonstração com dados locais fictícios e interpretação básica dos filtros. Configure OPENAI_API_KEY no arquivo .env para habilitar a interpretação avançada.

## Configurar Supabase

Crie um projeto Supabase separado para este app; não reutilize as chaves do Farma Pro.

1. Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.
2. Aplique supabase/migrations/202610170001_initial_schema.sql.
3. Carregue supabase/seed.sql para inserir registros de demonstração.
4. Configure DEMO_MODE=false quando a base real estiver pronta.

A busca usa somente uma chave publishable. A tabela tem RLS habilitado e permite leitura pública apenas dos restaurantes publicados. Nenhuma chave service_role é usada.

## Endpoints

- GET /api/health — estado do servidor.
- GET /api/meta — modo de dados e disponibilidade de IA.
- GET /api/restaurants?cuisine=Japonesa&maxBudget=60 — busca por filtros e, opcionalmente, proximidade com lat, lng e radiusKm.
- POST /api/recommend — recebe um JSON com message e retorna os filtros interpretados e os resultados.

## Deploy

O build do front-end é gerado em apps/web/dist. Configure as variáveis do arquivo .env.example no serviço da API e mantenha OPENAI_API_KEY somente no servidor, nunca em uma variável VITE_* pública.

## Próximos incrementos

- Favoritos persistidos por usuário e autenticação Supabase.
- Contribuição e moderação de restaurantes reais.
- Provedor de dados de lugares após revisar cobertura, licença e termos.
- Mapa interativo e rotas.
