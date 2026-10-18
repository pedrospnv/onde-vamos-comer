# API HTTP

Todos os endpoints são servidos pelo mesmo domínio do app. No desenvolvimento, use `http://localhost:3000`; em produção, a base é `https://onde-vamos-comer.onrender.com`.

## `GET /api/health`

Verifica se o processo Express está respondendo.

```json
{ "status": "ok" }
```

## `GET /api/meta`

Informa o modo de dados conhecido pelo servidor e se há uma chave de IA configurada.

```json
{ "dataMode": "openstreetmap", "aiEnabled": false }
```

`aiEnabled` indica presença de `OPENAI_API_KEY`; não valida a chave nem garante que a API externa esteja disponível.

## `GET /api/restaurants`

Busca uma página de lugares.

| Parâmetro | Tipo | Limite | Descrição |
| --- | --- | --- | --- |
| `cuisine` | texto | 60 caracteres | Correspondência parcial de culinária. |
| `q` | texto | 120 caracteres | Busca em nome, descrição, endereço e tags. |
| `maxBudget` | número | maior que 0 e até 10.000 | Filtra por preço conhecido. Locais sem preço continuam incluídos. |
| `lat` | número | -90 a 90 | Latitude de referência. Envie junto com `lng`. |
| `lng` | número | -180 a 180 | Longitude de referência. Envie junto com `lat`. |
| `radiusKm` | número | 1 a 100 | Raio da busca. O padrão da API é 45 km. |
| `limit` | inteiro | 1 a 100 | Resultados por página; padrão 50. |
| `offset` | inteiro | 0 a 10.000 | Deslocamento da paginação; padrão 0. |

Exemplo:

```http
GET /api/restaurants?cuisine=Japonesa&maxBudget=60&lat=-23.56&lng=-46.66&radiusKm=15&limit=50&offset=0
```

Resposta simplificada:

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Nome do local",
      "cuisine": "Japonesa",
      "price_per_person": null,
      "rating": null,
      "address": "São Paulo - SP",
      "lat": -23.56,
      "lng": -46.66,
      "distance_km": 1.2,
      "source": "openstreetmap",
      "source_url": "https://www.openstreetmap.org/node/123"
    }
  ],
  "count": 1,
  "dataMode": "openstreetmap"
}
```

Os campos `price_per_person`, `rating`, `rating_count`, `image_url` e `website_url` podem ser `null` quando a fonte não os fornece.

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

O campo obrigatório `message` aceita de 3 a 500 caracteres. `maxBudget`, `lat`, `lng` e `radiusKm` são opcionais e seguem os mesmos limites de `/api/restaurants`.

A resposta inclui `filters` (`cuisine`, `maxBudget`, `searchText` e `aiEnabled`), `items`, `count` e `dataMode`. Quando a OpenAI falha, a resposta continua usando a interpretação local.

## Erros e limites

- `400`: parâmetros ou corpo inválidos.
- `500`: falha ao consultar dados ou erro inesperado; a mensagem pública não expõe detalhes internos.
- Limite geral: 60 chamadas por minuto por origem.
- `POST /api/recommend`: 10 chamadas por minuto por origem.
