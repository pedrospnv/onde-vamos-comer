# Onde Vamos?

Um guia para descobrir onde comer em São Paulo com filtros de culinária, orçamento e distância. A busca aceita frases em português, como “japonês em Pinheiros até R$ 60”, e também pode ser usada só com filtros.

**Aplicação:** [onde-vamos-comer.onrender.com](https://onde-vamos-comer.onrender.com/)

**Cobertura atual:** a busca Google Places consulta lugares ao vivo sob demanda, com paginação de até 60 resultados por consulta. Isso não é um catálogo completo de São Paulo nem do estado; use bairro e culinária para explorar outras áreas.

## O que funciona hoje

- Busca de restaurantes, cafés, bares e outros lugares para comer, importados do OpenStreetMap.
- Busca ao vivo no Google Places quando `GOOGLE_PLACES_API_KEY` está configurada. A chave é mantida no servidor e as respostas não são armazenadas pelo app.
- Foursquare permanece como fonte reserva quando não houver chave do Google. O Supabase fornece os cadastros próprios quando nenhuma API externa está configurada.
- Filtros por culinária, texto e localização. A busca Google oferece até 60 resultados por consulta em páginas de 20; não representa cobertura completa da cidade.
- Localização do navegador somente depois de a pessoa tocar em **Alterar** e permitir o acesso.
- Lugares salvos no armazenamento local do navegador, sem conta de usuário.
- Cards só exibem restaurantes publicados com foto real carregando e creditada, descrição específica, cardápio oficial, preço com fonte e verificação recente. Registros incompletos ficam ocultos.
- A imagem japonesa do hero é ilustrativa e não representa um estabelecimento.
- Interpretação local de frases em português. A interpretação por OpenAI é opcional e precisa de uma chave de API no servidor.
- Atribuição ao OpenStreetMap e link para a origem de cada local.

## Limites conhecidos

- A base contém lugares mapeados dentro do município de São Paulo. O OpenStreetMap é colaborativo e não representa uma lista oficial ou completa.
- Sem a chave do Google ou do Foursquare, são mostrados apenas cadastros próprios que passaram pela curadoria rigorosa. Configure `GOOGLE_PLACES_API_KEY` no Render para priorizar a busca Google.
- A faixa do Foursquare não equivale a um preço em reais por pessoa. Preços exatos dependem de uma fonte oficial de cardápio, ainda não conectada.
- Resultados do Google e do Foursquare são consultados sem cache; favoritos dessas fontes ficam somente na sessão. A configuração padrão do Google não solicita avaliações, faixa de preço ou fotos.
- Sem `OPENAI_API_KEY`, o app usa uma interpretação local de culinária, orçamento e texto livre. A chave habilita a interpretação avançada no servidor.
- Favoritos ficam neste navegador e não sincronizam entre dispositivos.
- A atualização dos dados é manual; não há sincronização agendada.

## Tecnologias

- **Front-end:** Vue 3, Vite e `@lucide/vue`.
- **API:** Node.js 22+, Express 5, validação com Zod e limites de requisição.
- **Dados:** Supabase Postgres, PostGIS e Row Level Security.
- **Fonte geográfica:** OpenStreetMap via Overpass API, sob a licença ODbL.
- **Descoberta ao vivo:** Google Places API (New), com respostas sem cache e atribuição a Google Maps. Foursquare Places API permanece como alternativa.
- **Interpretação opcional:** OpenAI Responses API, restrita à extração de filtros — a IA não inventa restaurantes.
- **Hospedagem:** serviço web do Render que serve a API e os arquivos compilados do front-end.

## Rodar localmente

Requer Node.js 22.12 ou superior.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

O front-end abre em `http://localhost:5173` e a API em `http://localhost:3000`. Sem Supabase configurado, a API inicia, mas a busca não exibe dados fictícios.

## Configuração do Supabase

Use um projeto separado do Farma Pro. A aplicação precisa de `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` no servidor. A chave publishable é usada com RLS: usuários anônimos só podem ler restaurantes publicados e verificados; a importação usa uma chave administrativa exclusivamente no script local.

Em uma base nova, aplique as migrações em ordem:

1. `supabase/migrations/202610170001_initial_schema.sql`
2. `supabase/migrations/202610180001_restaurant_search_pagination.sql`
3. `supabase/migrations/20261018114537_verified_restaurants_only.sql`

Para carregar ou atualizar os lugares, configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` somente no ambiente local e execute:

```powershell
npm run import:openstreetmap
```

O importador consulta a área do município, atualiza registros pelo identificador OSM e marca como rascunho os locais que não vierem na consulta atual. Ele não deve ser executado sem querer contra outra base. Detalhes em [Dados e importação](docs/dados-e-importacao.md).

## Variáveis de ambiente

| Variável | Necessária | Uso |
| --- | --- | --- |
| `PORT` | Não | Porta HTTP. O Render injeta o valor; localmente usa `3000`. |
| `WEB_ORIGIN` | Não | Origem permitida pelo CORS quando front-end e API usam domínios diferentes. Localmente usa `http://localhost:5173`. |
| `SUPABASE_URL` | Sim para buscar dados | URL do projeto Supabase. |
| `SUPABASE_PUBLISHABLE_KEY` | Sim para buscar dados | Chave pública protegida por RLS, usada pela API. |
| `SUPABASE_SERVICE_ROLE_KEY` | Só para importar | Chave administrativa. Mantenha apenas no ambiente local durante a importação. |
| `OPENAI_API_KEY` | Não | Habilita a interpretação avançada no servidor. Não está habilitada no deploy atual. |
| `OPENAI_MODEL` | Não | Modelo usado pela Responses API; padrão `gpt-4.1-mini`. |
| `FOURSQUARE_API_KEY` | Não; alternativa | Chave privada do Foursquare Places API; configure somente no Render/servidor se usar como reserva. |
| `GOOGLE_PLACES_API_KEY` | Sim para priorizar Google | Chave privada do Places API (New); configure somente no Render/servidor e restrinja-a à API Places. |
| `GOOGLE_PLACES_INCLUDE_ENTERPRISE_FIELDS` | Não | Padrão `false`. `true` solicita avaliação e faixa geral de preço, ativando o nível Enterprise de faturamento. |
| `OVERPASS_URL` | Não | Endpoint alternativo do Overpass; por padrão usa `https://overpass-api.de/api/interpreter`. |

Nunca coloque chaves administrativas em variáveis `VITE_*`, no front-end, no GitHub ou em documentação.

O uso do Google Places segue as [políticas de atribuição e armazenamento](https://developers.google.com/maps/documentation/places/web-service/policies) e a [tabela de preços](https://developers.google.com/maps/billing-and-pricing/pricing). A configuração básica usa uma máscara de campos sem avaliações, faixa de preço ou fotos; esses campos têm níveis de faturamento mais altos, e fotos podem gerar chamadas adicionais. O Google exige faturamento ativo. Confira cotas, orçamento e alertas no Google Cloud antes de disponibilizar a chave. Consulte também os [termos de uso](/termos) e a [política de privacidade](/privacidade).

## Comandos do projeto

| Comando | Ação |
| --- | --- |
| `npm run dev` | Inicia a API e o Vite em modo de desenvolvimento. |
| `npm run build` | Verifica a sintaxe da API e gera o front-end em `apps/web/dist`. |
| `npm run check:api` | Verifica a sintaxe dos módulos da API e do importador. |
| `npm test` | Roda testes das integrações Google Places e Foursquare. |
| `npm start` | Inicia o servidor Express para desenvolvimento ou hospedagem. |
| `npm run import:openstreetmap` | Importa e sincroniza os locais do município no Supabase. |

Os testes usam respostas simuladas e não substituem uma validação ao vivo com uma chave válida.

## Documentação

- [Arquitetura](docs/arquitetura.md)
- [API HTTP](docs/api.md)
- [Dados e importação](docs/dados-e-importacao.md)
- [Interface e responsividade](docs/interface.md)
- [Desenvolvimento e deploy](docs/desenvolvimento-e-deploy.md)

## Créditos dos dados

© OpenStreetMap contributors. Dados sob [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/). A aplicação mantém a atribuição visível e oferece links para os registros de origem.
