# Interface e responsividade

## Direção visual

A interface usa uma hierarquia editorial simples e cores discretas: fundo claro, verde escuro para ações e um acento quente nos detalhes. O conteúdo prioriza busca, filtros e informações verificáveis, sem mascote, personagem ou efeitos visuais associados a uma IA.

No modo Supabase, os cards exigem foto real com crédito e origem, cardápio, preço em reais com fonte e verificação recente. No Google Places, os cards identificam o provedor, exibem a ficha do Google Maps e não inventam preço, foto ou avaliação; esses campos não são solicitados na configuração básica. No Foursquare, a faixa geral (`$` a `$$$$`) não representa gasto por pessoa. Se a imagem falhar ou não existir, aparece uma ilustração da culinária. A imagem japonesa do hero também é ilustrativa e não representa um estabelecimento específico.

## Comportamento por tela

- **Desktop:** hero em duas colunas, filtros em linha e grade de três cards.
- **Tablet:** largura de leitura limitada, grade de dois cards e áreas de toque preservadas.
- **Celular (até 640 px):** hero e seção explicativa empilhados, card em uma coluna, filtros verticais e navegação de culinárias com rolagem horizontal.
- **Celular estreito (até 380 px):** margens e controles compactados para larguras a partir de 320 px.
- **Acessibilidade:** foco visível no teclado, controles com nomes acessíveis, estados de botão e suporte a `prefers-reduced-motion`.
- Nas fontes ao vivo, a pessoa pode digitar uma cidade ou bairro ou permitir o GPS; a opção de GPS substitui a localidade digitada durante a busca.

## Área para melhorias futuras

- Curadoria de fotos autorizadas, cardápios e preços atuais para os restaurantes elegíveis.
- Testes automatizados em larguras comuns e leitores de tela.
- Testes automatizados em larguras comuns e leitores de tela.
- Navegação por mapa e fluxos de cadastro, caso façam parte do escopo futuro.

