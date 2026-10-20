# API HTTP

Todos os endpoints são servidos pelo mesmo domínio do app. No desenvolvimento, use `http://localhost:3000`; em produção, a base é `https://onde-vamos-comer.onrender.com`.

## `GET /api/health`

Verifica se o processo Express está respondendo.

```json
{ "status": "ok" }
```

## `GET /api/meta`

Informa o provedor ativo e se as chaves externas estão configuradas.

```json
{ "dataMode": "google", "aiEnabled": false, "foursquareEnabled": true, "googlePlacesEnabled": true, "googleEnterpriseFieldsEnabled": false }
```

`aiEnabled` indica presença de `OPENAI_API_KEY`; não valida a chave nem garante que a API externa esteja disponível.
`dataMode` é `curated` por padrão quando o Supabase está configurado. Isso consulta somente o catálogo editorial próprio e não chama APIs de terceiros. Para selecionar outra fonte, configure `RESTAURANT_DATA_SOURCE` com `google`, `foursquare` ou `openstreetmap`; uma chave de provedor sozinha não ativa chamadas.

## Catálogo próprio

O catálogo inicial é mantido nas tabelas `curated_restaurants`, `curated_restaurant_photos` e `curated_menu_items`. A API é somente de leitura. Apenas linhas publicadas com ficha verificada nos últimos 180 dias são visíveis ao cliente anônimo. Fotos precisam guardar crédito, licença e página de origem; preços de cardápio guardam modalidade, fonte, data consultada e estado de confirmação.

### `GET /api/catalog/restaurants`

Lista o catálogo próprio usando os mesmos filtros de `GET /api/restaurants` e paginação por `limit`/`offset`.

### `GET /api/catalog/restaurants/:slug`

Retorna `{ "item": ... }` para uma ficha publicada. Um slug inválido retorna `400`; uma ficha indisponível retorna `404`.

Para ampliar o catálogo, insira os dados por uma migração administrativa no Supabase. Não se deve conceder `INSERT`/`UPDATE` a `anon` ou `authenticated`, nem colocar a chave `service_role` no cliente. Preço de item/combo não é automaticamente gasto por pessoa; só `price_per_person` confiável pode alimentar esse filtro.

## `GET /api/restaurants`

Busca uma página de lugares.

| Parâmetro | Tipo | Limite | Descrição |
| --- | --- | --- | --- |
| `cuisine` | texto | 60 caracteres | Correspondência parcial de culinária. |
| `q` | texto | 120 caracteres | Busca em nome, descrição, culinária e bairro no catálogo próprio. |
| `near` | texto | 120 caracteres | Bairro para o catálogo próprio ou busca no Google/Foursquare, como `Pinheiros`. |
| `maxBudget` | número | maior que 0 e até 10.000 | Filtra estimativas confiáveis por pessoa. Itens sem essa estimativa permanecem visíveis e são identificados como preço desconhecido. |
| `maxPriceLevel` | inteiro | 1 a 4 | Filtra faixa geral; no Google depende de `GOOGLE_PLACES_INCLUDE_ENTERPRISE_FIELDS=true`. Nunca representa gasto em reais por pessoa. |
| `lat` | número | -90 a 90 | Latitude de referência. Envie junto com `lng`. |
| `lng` | número | -180 a 180 | Longitude de referência. Envie junto com `lat`. |
| `radiusKm` | número | 1 a 100 | Raio da busca. O padrão da API é 45 km. |
| `limit` | inteiro | 1 a 100 | Resultados por página; Google limita a 20, os demais provedores usam até 100. |
| `offset` | inteiro | 0 a 10.000 | Deslocamento da paginação; padrão 0. |
| `pageToken` | texto | 2.048 caracteres | Token opaco de próxima página devolvido pelo Google. |

Exemplo:

```http
GET /api/restaurants?cuisine=Japonesa&maxBudget=60&lat=-23.56&lng=-46.66&radiusKm=15&limit=50&offset=0
```

Resposta simplificada (os domínios `exemplo.com` e os valores abaixo são placeholders de documentação):

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Nome do estabelecimento",
      "cuisine": "Japonesa",
      "description": "Descrição específica do estabelecimento e de sua culinária.",
      "price_per_person": 48.00,
      "rating": null,
      "address": "São Paulo - SP",
      "lat": -23.56,
      "lng": -46.66,
      "distance_km": 1.2,
      "image_url": "https://exemplo.com/foto.jpg",
      "image_attribution": "Crédito da fotografia",
      "image_source_url": "https://exemplo.com/origem-da-foto",
      "menu_url": "https://exemplo.com/cardapio",
      "price_source_url": "https://exemplo.com/precos",
      "verified_at": "2026-10-18T12:00:00Z",
      "menu_price_min": 32.90,
      "menu_price_max": 85.50,
      "menu_prices_need_confirmation": true,
      "menu_items": [],
      "image_license": "CC BY-SA 4.0",
      "image_license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
      "source": "curated",
      "source_url": "https://example.org/restaurante"
    }
  ],
  "count": 1,
  "dataMode": "curated"
}
```

Preço por pessoa, avaliação e coordenadas podem ser `null` quando não houver uma fonte confiável. O catálogo guarda separadamente preços individuais de menu; esses preços não significam custo médio por pessoa. O front-end mostra a data consultada e sinaliza os valores que precisam de confirmação.

No modo Google, os resultados são consultados ao vivo em páginas de até 20; o endpoint pode fornecer até 60 resultados por consulta. `pageToken` encaminha a próxima página. A configuração padrão não solicita preço, avaliação ou fotos; são campos com faturamento mais alto. Respostas usam `no-store` e não são persistidas. O Google recebe bairro/cidade digitado ou coordenadas quando a pessoa permite usar o GPS. A busca é por relevância e não constitui cobertura completa de São Paulo.

No modo Foursquare, os resultados são consultados ao vivo e alguns campos podem estar ausentes. `price_level` é uma faixa geral; `price_per_person` continua `null`. Respostas usam `no-store`, não são persistidas e a busca tem limite de 10 chamadas por minuto por origem.

## `POST /api/recommend`

Interpreta uma frase em português e retorna filtros e lugares. A integração OpenAI é opcional; sem ela, o servidor usa regras locais.

```http
POST /api/recommend
Content-Type: application/json
```

```json
{
  "message": "japonês em Pinheiros até R$ 60",
  "maxBudget": 60,
  "lat": -23.56,
  "lng": -46.66,
  "radiusKm": 15
}
```

O campo obrigatório `message` aceita de 3 a 500 caracteres. `maxBudget`, `near`, `lat`, `lng` e `radiusKm` são opcionais e seguem os mesmos limites de `/api/restaurants`.

A resposta inclui `filters` (`cuisine`, `maxBudget`, `searchText` e `aiEnabled`), `items`, `count` e `dataMode`. Se a frase tiver um orçamento em reais e o provedor ativo não tiver preços exatos por pessoa, `budgetNotice` informa essa limitação. Quando a OpenAI falha, a resposta continua usando a interpretação local.

## Erros e limites

- `400`: parâmetros ou corpo inválidos.
- `500`: falha ao consultar dados ou erro inesperado; a mensagem pública não expõe detalhes internos.
- Limite geral: 60 chamadas por minuto por origem.
- `GET /api/restaurants`: 10 chamadas por minuto por origem para controlar chamadas externas.
- `POST /api/recommend`: 10 chamadas por minuto por origem.
