# Onde Vamos?

Aplicação de portfólio para explorar uma seleção curada de restaurantes do município de São Paulo. A pessoa pode filtrar por culinária e bairro, permitir o uso do GPS e abrir os detalhes e as fontes de cada ficha.

**Aplicação:** [onde-vamos-comer.onrender.com](https://onde-vamos-comer.onrender.com/)

## Estado atual

- O catálogo ativo é próprio e fica no Supabase. Há 20 restaurantes publicados; não é um guia completo da cidade nem do estado.
- Cada restaurante tem uma foto principal com crédito, licença e página de origem. Algumas imagens mostram pratos relacionados ao lugar, não a fachada ou o interior.
- O catálogo tem 50 valores de itens de menu. Nenhum está confirmado como preço atual: 19 são históricos e 31 precisam de confirmação. Eles não representam gasto por pessoa.
- As fichas não têm coordenadas no banco. O servidor mantém coordenadas auxiliares para cinco locais; por isso, a distância só pode ser exibida para parte do catálogo.
- Horários e avaliações não estão disponíveis no catálogo curado e aparecem como não informados.
- Google Places, Foursquare e OpenStreetMap não são consultados no modo padrão. Fontes externas só são chamadas se `RESTAURANT_DATA_SOURCE` for alterada explicitamente no servidor.
- A localização do navegador só é solicitada após a ação da pessoa. O app usa as coordenadas para ordenar resultados com distância calculável e não as salva.
- Favoritos ficam no armazenamento local do navegador; não há conta ou sincronização entre dispositivos.
- A interpretação da busca usa regras locais. A integração com OpenAI é opcional e não está habilitada no deploy atual.

Consulte [Dados e curadoria](docs/dados-e-importacao.md) para limitações, fontes e critérios de publicação.

## Tecnologias

- **Front-end:** Vue 3, Vite e `@lucide/vue`.
- **API:** Node.js 22+, Express 5 e validação com Zod.
- **Dados:** Supabase Postgres com Row Level Security.
- **Hospedagem:** Render, com front-end e API no mesmo domínio.
- **Fontes opcionais:** Google Places, Foursquare e OpenStreetMap/Overpass. O uso depende de configuração e, em alguns casos, faturamento externo.

## Rodar localmente

Requer Node.js 22.12 ou superior.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

O front-end abre em `http://localhost:5173` e a API em `http://localhost:3000`. Configure `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` para carregar o catálogo. Sem credenciais válidas, a aplicação não cria restaurantes fictícios.

## Banco de dados

Use um projeto separado de outros produtos. Aplique as migrações em ordem cronológica:

1. `supabase/migrations/202610170001_initial_schema.sql`
2. `supabase/migrations/202610180001_restaurant_search_pagination.sql`
3. `supabase/migrations/20261018114537_verified_restaurants_only.sql`
4. `supabase/migrations/20261020212737_curated_restaurant_catalog.sql`

O app usa a chave publishable com RLS. A chave `SUPABASE_SERVICE_ROLE_KEY` é administrativa e só deve ser usada localmente para importação autorizada; nunca a coloque no cliente, no Render ou em `VITE_*`.

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `PORT` | Porta HTTP; o Render injeta o valor. |
| `WEB_ORIGIN` | Origens permitidas por CORS. |
| `SUPABASE_URL` | URL do projeto Supabase. |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública usada pela API com RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Importação local; nunca use no serviço web. |
| `RESTAURANT_DATA_SOURCE` | `curated` por padrão; fontes externas só são consultadas quando explicitamente selecionadas. |
| `GOOGLE_PLACES_ENABLED`, `GOOGLE_PLACES_API_KEY` | Habilitam Google Places quando `RESTAURANT_DATA_SOURCE=google`. Pode haver cobrança. |
| `FOURSQUARE_API_KEY` | Habilita Foursquare quando `RESTAURANT_DATA_SOURCE=foursquare`. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Habilitam interpretação opcional da frase de busca. |
| `OVERPASS_URL` | Endpoint opcional para o importador OSM. |

Nunca publique chaves em arquivos, commits ou capturas de tela. Ativar Google Places exige cuidado com faturamento e limites da conta.

## Comandos

| Comando | Ação |
| --- | --- |
| `npm run dev` | Inicia API e Vite em desenvolvimento. |
| `npm run build` | Verifica a sintaxe da API e compila o front-end. |
| `npm run check:api` | Verifica sintaxe dos módulos da API e importador. |
| `npm test` | Roda testes automatizados locais. |
| `npm start` | Inicia o servidor Express. |
| `npm run import:openstreetmap` | Importa pontos OSM para a tabela legada; não alimenta o catálogo curado. |

Os testes usam dados simulados e não provam que chaves ou serviços externos estão ativos.

## Documentação

- [Arquitetura](docs/arquitetura.md)
- [API HTTP](docs/api.md)
- [Dados e curadoria](docs/dados-e-importacao.md)
- [Interface e responsividade](docs/interface.md)
- [Desenvolvimento e deploy](docs/desenvolvimento-e-deploy.md)

O catálogo guarda a fonte e a situação de confirmação dos dados. Confira os detalhes diretamente com o estabelecimento antes de tomar decisões com base em horários ou valores.
