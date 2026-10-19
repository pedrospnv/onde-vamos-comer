# API HTTP

Todos os endpoints são servidos pelo mesmo domínio do app. No desenvolvimento, use `http://localhost:3000`; em produção, a base é `https://onde-vamos-comer.onrender.com`.

## `GET /api/health`

Verifica se o processo Express está respondendo.

```json
{ "status": "ok" }
```

## `GET /api/meta`

Informa o provedor ativo e se as chaves de IA e Foursquare estão configuradas.

```json
{ "dataMode": "foursquare", "aiEnabled": false, "foursquareEnabled": true }
```

`aiEnabled` indica presença de `OPENAI_API_KEY`; não valida a chave nem garante que a API externa esteja disponível.
`dataMode` será `foursquare` quando `FOURSQUARE_API_KEY` estiver configurada. Sem a chave, a API consulta apenas os registros próprios verificados do Supabase.

## `GET /api/restaurants`

Busca uma página de lugares.

| Parâmetro | Tipo | Limite | Descrição |
| --- | --- | --- | --- |
| `cuisine` | texto | 60 caracteres | Correspondência parcial de culinária. |
| `q` | texto | 120 caracteres | Busca em nome, descrição, endereço e tags. |
| `near` | texto | 120 caracteres | Cidade/bairro para a busca Foursquare, como `Campinas, SP`; ignorado pela busca Supabase. |
| `maxBudget` | número | maior que 0 e até 10.000 | Filtra o preço verificado por pessoa. Registros sem preço não são publicados pela API. |
| `maxPriceLevel` | inteiro | 1 a 4 | No modo Foursquare, filtra faixa geral (`1` mais econômico; `4` mais caro), sem valor em reais por pessoa. |
| `lat` | número | -90 a 90 | Latitude de referência. Envie junto com `lng`. |
| `lng` | número | -180 a 180 | Longitude de referência. Envie junto com `lat`. |
| `radiusKm` | número | 1 a 100 | Raio da busca. O padrão da API é 45 km. |
| `limit` | inteiro | 1 a 100 | Resultados por página; padrão 50. |
| `offset` | inteiro | 0 a 10.000 | Deslocamento da paginação; padrão 0. |

Exemplo:

```http
GET /api/restaurants?cuisine=Japonesa&maxBudget=60&lat=-23.56&lng=-46.66&radiusKm=15&limit=50&offset=0
```

Resposta simplificada (os domínios `exemplo.com` e os valores abaixo são placeholders de documentação, não restaurantes publicados):

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
      "source": "openstreetmap",
      "source_url": "https://www.openstreetmap.org/node/123"
    }
  ],
  "count": 1,
  "dataMode": "openstreetmap"
}
```

Preço, descrição, foto, crédito, origem da foto, cardápio e fonte do preço são obrigatórios para qualquer resultado. Avaliação e site oficial podem ser `null` quando não houver uma fonte confiável.

No modo Foursquare, os resultados são consultados ao vivo e alguns campos podem estar ausentes. `price_level` é uma faixa geral; `price_per_person` continua `null`. Respostas e fotos usam `no-store`, não são persistidas e a busca tem limite de 10 chamadas por minuto por origem. A API recebe `near` quando a pessoa escolhe cidade/bairro, ou coordenadas quando permite usar o GPS; sem ambos usa São Paulo como localidade padrão. Não há paginação adicional nesse modo.

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

A resposta inclui `filters` (`cuisine`, `maxBudget`, `searchText` e `aiEnabled`), `items`, `count` e `dataMode`. Se a frase tiver um orçamento em reais e o provedor ativo for Foursquare, `budgetNotice` explica que esse filtro exato não está disponível. Quando a OpenAI falha, a resposta continua usando a interpretação local.

## Erros e limites

- `400`: parâmetros ou corpo inválidos.
- `500`: falha ao consultar dados ou erro inesperado; a mensagem pública não expõe detalhes internos.
- Limite geral: 60 chamadas por minuto por origem.
- `GET /api/restaurants`: 10 chamadas por minuto por origem para controlar chamadas externas.
- `POST /api/recommend`: 10 chamadas por minuto por origem.
