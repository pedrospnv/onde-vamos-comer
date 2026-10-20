# Interface e responsividade

## Direção visual

A interface usa fundo claro, tipografia de leitura direta e detalhes em verde e tons quentes. O foco é comparar lugares e consultar fontes, com mensagens explícitas quando preço, avaliação, horário ou distância não existem.

## Comportamento do catálogo curado

- A seleção atual tem 20 fichas do município de São Paulo.
- Cada ficha tem uma imagem principal licenciada e creditada. Algumas imagens mostram pratos e não a fachada ou o interior; a ficha liga à fonte original.
- Os preços são de itens de menu. No conjunto atual, 19 valores estão marcados como históricos e 31 precisam de confirmação; nenhum está confirmado como atual. O app não oferece filtro de gasto por pessoa neste modo.
- Coordenadas estão disponíveis apenas para parte das fichas, então localização e distância são parciais. Horários e avaliações não estão cadastrados.
- Fichas de catálogo não são mantidas por atualizações automáticas. A data de revisão não substitui a conferência direta com o restaurante.

Google Places e Foursquare são integrações opcionais, desligadas no modo padrão. A imagem japonesa do hero é ilustrativa e não representa um dos restaurantes.

## Telas e acessibilidade

- **Desktop:** hero em duas colunas, filtros em linha e grade de três cards.
- **Tablet:** conteúdo com largura limitada e grade de dois cards.
- **Celular até 640 px:** hero empilhado, cards em uma coluna, filtros verticais e culinárias com rolagem horizontal.
- **Celular estreito até 380 px:** controles compactados a partir de 320 px.
- Foco de teclado visível, nomes acessíveis para controles e respeito a `prefers-reduced-motion`.
- GPS só é solicitado após o clique. A pessoa pode negar, escolher bairro ou continuar sem localização.

## Melhorias que dependem de dados

Fotos de fachada/interior, coordenadas para todas as fichas, preços atuais, horários e avaliações exigem fontes públicas confiáveis ou conferência dos estabelecimentos. A interface pode exibir esses dados quando a curadoria os receber; hoje não deve inventá-los.
