# Dados e curadoria

## Catálogo ativo

O modo padrão do app consulta o catálogo próprio no Supabase, nas tabelas `curated_restaurants`, `curated_restaurant_photos` e `curated_menu_items`. A consulta de produção é somente leitura para o app. O catálogo atual contém 20 fichas publicadas do município de São Paulo; não cobre todo o município nem o estado.

As fontes Google Places, Foursquare e OpenStreetMap/Overpass pertencem a integrações separadas. Elas não são chamadas no modo padrão; mudar `RESTAURANT_DATA_SOURCE` pode ativar chamadas externas e custos associados. A tabela legada `public.restaurants` recebe o importador OSM, mas não é a fonte do catálogo curado.

## Limites conhecidos do catálogo atual

- Há 20 fotos principais, todas com crédito, licença e página de origem. Algumas imagens são de pratos relacionados ao restaurante, não necessariamente da fachada ou do interior. A página de origem permite conferir o contexto.
- Existem 50 preços de itens de menu. Nenhum está marcado como atual: 19 são históricos e 31 precisam de confirmação. A interface identifica essa condição e não transforma preço de prato/combinação em gasto por pessoa.
- As 20 fichas estão sem coordenadas no banco. A API tem coordenadas auxiliares para cinco slugs; a distância, portanto, aparece apenas para uma parte da seleção. Não preencha coordenadas estimadas sem checar o endereço e a origem.
- O catálogo não tem avaliações nem horários de funcionamento. Esses campos ficam como não informados.
- A verificação editorial da ficha expira após 180 dias; ela não significa monitoramento automático nem confirmação diária de cardápios ou horários.

## Critérios de publicação

Uma ficha publicada deve ter nome, culinária, descrição específica e fonte da descrição, endereço, link de origem, verificação recente, foto principal com licença/crédito/página de origem e ao menos um item de menu com fonte, data consultada, modalidade e estado do preço. Coordenadas, website, menu e estimativa por pessoa são opcionais; quando desconhecidos, devem continuar nulos.

`verified_at` indica a revisão da ficha, não que todos os preços ainda sejam válidos. Cada item tem `price_status`: `current`, `needs_confirmation` ou `historical`. Só dados efetivamente verificados podem ser marcados `current`. Preço de unidade, prato, porção, combo ou delivery não é uma estimativa de gasto por pessoa.

## Tabelas

- `curated_restaurants`: nome, endereço, culinária, descrição, fontes, coordenadas opcionais, preço por pessoa opcional, status e data da revisão.
- `curated_restaurant_photos`: URL, crédito, licença, página de origem, foto principal e data de verificação.
- `curated_menu_items`: nome do item, valor, base do preço, modalidade, fonte, data consultada e estado de confirmação.
- `restaurants`: tabela legada alimentada pelo importador OSM. Não confundir com o catálogo curado servido por padrão.

RLS está habilitada nas quatro tabelas. As policies do catálogo permitem leitura somente de registros publicados e revisados nos últimos 180 dias. O serviço web usa `SUPABASE_PUBLISHABLE_KEY`; a chave `service_role` não deve ser concedida ao front-end nem ao Render.

## Atualização editorial

Atualize registros do catálogo após conferir as páginas de origem. Mantenha a licença, o crédito e o link da imagem; registre a data real de consulta de cada item. Se a foto for de um prato, descreva-a como imagem do prato. Não declare preço atual, horário, avaliação ou coordenada sem fonte.

O catálogo curado ainda não tem um painel administrativo nem sincronização automática. A inclusão de fichas é feita por alteração administrativa revisada no Supabase. Não atualize `verified_at` em lote para prolongar a publicação sem revisar a informação.

## Importador OpenStreetMap legado

O script `npm run import:openstreetmap` consulta a área municipal de São Paulo (relação OSM `298285`) pela Overpass API e escreve na tabela `public.restaurants`. Execute localmente com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` apontados ao projeto certo; o script pode atualizar e retirar registros dessa tabela. Ele não cria fichas curadas nem preços, fotos licenciadas ou avaliações. Use `--export-json` para revisar os resultados sem gravar.

Os dados OSM são colaborativos e licenciados sob [ODbL](https://opendatacommons.org/licenses/odbl/). A importação não é uma lista oficial ou completa de estabelecimentos.
