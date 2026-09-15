# Painel de TV adaptável à resolução

## Objetivo
Fazer cada tela do Modo Exibição ocupar integralmente a área visível da TV, sem barras de rolagem ou conteúdo cortado, mantendo números e informações legíveis à distância.

## Implementação
- Criar uma área-base de proporção 16:9 que mede o espaço realmente disponível e aplica uma escala uniforme pela largura e pela altura, inclusive após entrar/sair da tela cheia ou mudar a resolução.
- Usar essa mesma área-base tanto no Modo Exibição quanto nas prévias, evitando diferenças entre o que é configurado e o que aparece na TV.
- Ajustar as telas de colaboradores e setores para trabalhar com altura limitada, grades estáveis e conteúdo interno sem rolagem.
- Substituir dimensões rígidas relevantes por proporções e limites responsivos, preservando tamanhos mínimos legíveis para títulos, indicadores, metas e resultados.
- Manter a paginação e rotação atuais: cada grupo continua sendo exibido separadamente, sem aumentar a quantidade de itens por página.
- Garantir que controles de som e saída permaneçam acessíveis sem cobrir informações.

## Validação
- Conferir o Modo Exibição em 1920×1080 e 3840×2160, além de uma resolução 16:10 comum.
- Verificar ausência de rolagem e cortes nas telas de colaboradores e setores, incluindo grupos cheios e múltiplos horários.
- Confirmar que rotação, paginação, tela cheia, som e saída continuam funcionando.

## Detalhes técnicos
- O conteúdo terá uma referência visual de 1920×1080 e será escalado com `min(largura disponível / 1920, altura disponível / 1080)`.
- Um `ResizeObserver` acompanhará alterações reais do dispositivo e do modo tela cheia.
- A área externa centralizará o painel e ocultará somente excedentes fora da proporção, nunca conteúdo interno.
- Respeitar `prefers-reduced-motion` nas transições existentes.
