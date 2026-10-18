# Interface e responsividade

## Direção visual

A interface usa uma hierarquia editorial simples e cores discretas: fundo claro, verde escuro para ações e um acento quente nos detalhes. O conteúdo prioriza busca, filtros e informações verificáveis, sem mascote, personagem ou efeitos visuais associados a uma IA.

Quando o banco tem uma imagem de origem, ela aparece no card. Sem essa imagem, o card usa uma foto ilustrativa local correspondente à culinária e deixa isso indicado sobre a foto. A foto de culinária japonesa também aparece no hero; não representa um restaurante específico. Preço e avaliação ausentes continuam claramente sinalizados.

## Comportamento por tela

- **Desktop:** hero em duas colunas, filtros em linha e grade de três cards.
- **Tablet:** largura de leitura limitada, grade de dois cards e áreas de toque preservadas.
- **Celular (até 640 px):** hero e seção explicativa empilhados, card em uma coluna, filtros verticais e navegação de culinárias com rolagem horizontal.
- **Celular estreito (até 380 px):** margens e controles compactados para larguras a partir de 320 px.
- **Acessibilidade:** foco visível no teclado, controles com nomes acessíveis, estados de botão e suporte a `prefers-reduced-motion`.

## Área para melhorias futuras

- Imagens reais autorizadas ou fornecidas pelos estabelecimentos para substituir as ilustrações.
- Preços e avaliações de uma fonte licenciada e atualizada.
- Testes automatizados em larguras comuns e leitores de tela.
- Navegação por mapa e fluxos de cadastro, caso façam parte do escopo futuro.

