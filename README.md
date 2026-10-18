# Onde Vamos?

App para descobrir lugares para comer na cidade de São Paulo conforme a culinária, o orçamento e a distância. A busca aceita frases como “japonês em Pinheiros até R$ 60”.

## Dados reais e limites

Os restaurantes são importados do OpenStreetMap para o Supabase usando o limite municipal de São Paulo. A cobertura depende do que a comunidade mapeou e não é uma lista oficial completa. O app não inventa preços ou avaliações: quando esses dados não estão disponíveis, exibe isso claramente e ainda permite descobrir o local pelo mapa.

Os dados do OpenStreetMap são disponibilizados sob a Open Database License (ODbL). O app exibe a atribuição exigida e o importador mantém o identificador e a página de origem de cada local.

## Stack

- Vue 3 + Vite no front-end
- Node.js + Express na API
- Supabase Postgres com PostGIS para os locais e a busca geográfica
- OpenStreetMap como fonte de locais
- OpenAI Responses API para interpretar pedidos em linguagem natural (opcional; há uma interpretação local simples)

## Rodar localmente

Requer Node.js 22.12 ou superior.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

A interface abre em http://localhost:5173 e a API em http://localhost:3000. Sem Supabase configurado, a aplicação mostra o estado de configuração e não usa restaurantes fictícios.

## Configurar Supabase

Crie um projeto Supabase separado para este app; não reutilize as chaves do Farma Pro. Use a região São Paulo (`sa-east-1`) se disponível.

1. Configure `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` no serviço da API e no ambiente de build do front-end, se necessário.
2. Aplique `supabase/migrations/202610170001_initial_schema.sql`.
3. Para importar os restaurantes, configure localmente `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` e rode `npm run import:openstreetmap`.
4. A chave `SUPABASE_SERVICE_ROLE_KEY` é usada apenas pelo importador local. Nunca a coloque em `VITE_*`, no front-end, no GitHub ou em mensagens.

O importador consulta os restaurantes, cafés, lanchonetes, bares e pubs mapeados dentro do município de São Paulo, atualiza registros existentes e despublica locais que deixaram de aparecer na consulta. A primeira importação pode demorar; execute novamente mais tarde para atualizar os dados.

## Endpoints

- `GET /api/health` — estado do servidor.
- `GET /api/meta` — estado da base e disponibilidade de IA.
- `GET /api/restaurants?cuisine=Japonesa&maxBudget=60` — busca por culinária, orçamento e distância. Locais sem preço continuam visíveis e são marcados como desconhecidos.
- `POST /api/recommend` — recebe `{ "message": "japonês em Pinheiros até R$ 60" }` e retorna filtros interpretados e resultados.

## Variáveis de ambiente

Veja `.env.example`. Mantenha `OPENAI_API_KEY` e qualquer chave administrativa apenas no servidor. Restrinja a chave publishable do front-end às permissões públicas protegidas por RLS.

## Deploy

O build do front-end é gerado em `apps/web/dist`; a API Express serve esse diretório. No Render, use `npm ci` como build command e `npm start` como start command. Configure a URL pública em `WEB_ORIGIN` e as chaves Supabase no ambiente do serviço.

