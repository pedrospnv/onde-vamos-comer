# Dados e importação

## Fonte e cobertura

Os locais vêm do OpenStreetMap por meio da Overpass API. O importador consulta a relação municipal `298285` de São Paulo e inclui pontos mapeados como restaurante, fast food, café, bar, pub e sorveteria. A cobertura é do município de São Paulo, não do estado inteiro.

O OpenStreetMap é uma base colaborativa; não é uma listagem oficial, completa ou garantia de que um estabelecimento continua aberto. A importação inicial carregou cerca de 4,6 mil locais. A quantidade muda com as edições e consultas futuras.

Os dados são publicados sob a [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/). A aplicação atribui os contribuidores do OpenStreetMap e mantém `source`, `external_id` e `source_url` em cada registro.

## Qualidade dos campos

- **Nome e coordenadas:** usados quando presentes na fonte.
- **Culinária:** classificação por tags OSM; quando não há informação, fica como `Não informada`.
- **Endereço e descrição:** podem estar incompletos ou ser texto livre da comunidade.
- **Preço e avaliação:** não são fornecidos de forma consistente pelo OSM. Estão vazios na base atual e nunca são estimados pelo app.
- **Imagens:** não são baixadas pelo importador; a interface usa um marcador visual neutro quando não há imagem.
- **Situação comercial:** pode mudar depois da última edição OSM. Confirme o local e o preço antes de sair.

O filtro por orçamento aceita resultados sem preço conhecido. Assim, ele não promete que todos os lugares respeitem o valor escolhido; o app apresenta um aviso junto aos resultados.

## Esquema

`public.restaurants` guarda:

- Identidade: `id`, `name`, `slug`.
- Classificação: `cuisine`, `description`, `tags`.
- Preço e nota opcionais: `price_per_person`, `rating`, `rating_count`.
- Endereço: `address`, `city`, `state` e `location` em `geography(Point, 4326)`.
- Links: `website_url`, `source_url`.
- Proveniência e sincronização: `source`, `external_id`, `last_synced_at`.
- Estado: `status` (`draft` ou `published`) e `is_demo` fixo em `false`.

RLS permite leitura anônima somente dos registros publicados. A busca ocorre pela função Postgres `search_restaurants`, que aplica paginação, filtros textuais, distância e ordenação.

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
