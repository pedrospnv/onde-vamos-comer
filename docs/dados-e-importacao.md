# Dados e importação

## Fonte e cobertura

Os locais vêm do OpenStreetMap por meio da Overpass API. O importador consulta a relação municipal `298285` de São Paulo e inclui pontos mapeados como restaurante, fast food, café, bar, pub e sorveteria. A cobertura é do município de São Paulo, não do estado inteiro.

O OpenStreetMap é uma base colaborativa; não é uma listagem oficial, completa ou garantia de que um estabelecimento continua aberto. A importação inicial carregou cerca de 4,6 mil locais. A quantidade muda com as edições e consultas futuras.

Os dados são publicados sob a [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/). A aplicação atribui os contribuidores do OpenStreetMap e mantém `source`, `external_id` e `source_url` em cada registro.

Quando `FOURSQUARE_API_KEY` está configurada, a busca consulta a Places API ao vivo. Os resultados não são gravados no Supabase nem armazenados em cache pelo app; a chave fica no servidor. A busca abrange a localidade informada em cada consulta, não uma exportação completa de todo o estado de São Paulo.

## Qualidade dos campos

- **Nome e coordenadas:** usados quando presentes na fonte.
- **Culinária:** classificação por tags OSM; quando não há informação, fica como `Não informada`.
- **Endereço e descrição:** podem estar incompletos ou ser texto livre da comunidade. A descrição publicada precisa ser específica e ter pelo menos 40 caracteres.
- **Preço, cardápio e imagens:** não são fornecidos de forma confiável pelo OSM. O app não estima nem substitui esses dados por conteúdo ilustrativo.
- **Situação comercial:** só é considerada verificada por até 180 dias após a conferência. Alterações em nome, endereço, descrição, culinária, preço, foto, cardápio ou fonte invalidam automaticamente essa conferência.

## Critérios de publicação

Um restaurante só aparece quando está publicado e tem culinária identificada, descrição específica, preço por pessoa maior que zero, cardápio oficial, fonte do preço, foto real com crédito e link de origem, além de `verified_at` preenchido nos últimos 180 dias. Todos os links precisam usar HTTPS. RLS e a função de busca aplicam os mesmos critérios; a interface também rejeita registros incompletos e oculta fotos que não carregam.

Preencha os campos na tabela `public.restaurants` somente depois de conferir o estabelecimento e as fontes. `verified_at` é a data da conferência manual; não a atualize por rotina automática. Se algum dado relevante mudar, refaça a verificação para tornar o registro visível novamente.

## Esquema

`public.restaurants` guarda:

- Identidade: `id`, `name`, `slug`.
- Classificação: `cuisine`, `description`, `tags`.
- Preço e nota opcionais: `price_per_person`, `rating`, `rating_count`.
- Dados obrigatórios para aparecer: `image_url`, `image_attribution`, `image_source_url`, `menu_url`, `price_source_url`, `verified_at`.
- Endereço: `address`, `city`, `state` e `location` em `geography(Point, 4326)`.
- Links: `website_url`, `source_url`.
- Proveniência e sincronização: `source`, `external_id`, `last_synced_at`.
- Estado: `status` (`draft` ou `published`) e `is_demo` fixo em `false`.

RLS permite leitura anônima somente dos restaurantes publicados que passam por todos os critérios de curadoria. A função Postgres `search_restaurants` repete esses critérios e aplica paginação, filtros textuais, distância e ordenação.

Na busca ao vivo do Foursquare, a classificação de preço é uma faixa geral de 1 a 4, não um valor em reais por pessoa. Detalhes podem estar ausentes e devem ser confirmados no site ou cardápio oficial do restaurante. Favoritos desse provedor ficam somente na sessão atual.

## Importar ou atualizar

1. Configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` em `.env` local. Não configure a chave administrativa no Render nem em `VITE_*`.
2. Rode `npm run import:openstreetmap`.
3. Confira no terminal a contagem `imported`, `retired` e `updatedAt`.

O script lê o Overpass, faz upsert em lotes de 500 por `source,external_id` e marca como `draft` registros publicados que não apareceram na resposta atual. Se a consulta vier vazia, ele aborta antes de alterar registros existentes. A execução escreve no banco: confirme que `SUPABASE_URL` aponta para o projeto Onde Vamos? antes de rodar.

Para exportar a resposta sem gravar no banco:

```powershell
npm run import:openstreetmap -- --export-json .\osm-export.json
```

Overpass pode limitar ou atrasar consultas. Em caso de falha, tente novamente mais tarde ou configure outro endpoint permitido por `OVERPASS_URL`.
