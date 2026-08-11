# Production Tracker

Prompt para o Lovable — Sistema de Marcação de Produção (Confecção)

Copie e cole o texto abaixo no Lovable. Ele já está estruturado em visão geral, módulos, modelo de dados, fluxos e regras de negócio.

PROMPT

Quero criar um sistema web de marcação de produção para uma confecção de vestuário. O sistema tem 4 módulos principais que se conectam entre si: Produtos, Colaboradores, Configuração de Horários e Marcação de Produção. Abaixo está o detalhamento completo de cada um.

1. Módulo de Produtos (cadastro)

Ao cadastrar um produto, preciso informar:

Nome do produto (ex: Bermuda Cargo)

Referência do modelo (ex: REF: 123)

Número da Ordem de Produção (OP) (ex: OP: 123)

Marca (ex: Sky)

Quantidade total a ser produzida nessa ordem

Lista de operações que compõem a produção dessa peça (cada operação é uma etapa do processo de costura). Exemplo real:

Barra de 2cm

Cós com duas agulhas

5 passantes

Cada operação cadastrada dentro de um produto deve ter pelo menos: nome da operação e, opcionalmente, um tempo padrão estimado (útil futuramente para cálculo de produtividade, mas não obrigatório agora).

Um produto pode ter várias operações associadas, e essas operações ficam vinculadas àquela OP específica (ou seja, se a mesma referência de bermuda tiver duas OPs diferentes, cada OP pode ter sua própria lista de operações, mesmo que geralmente se repita).

Tela de listagem de produtos deve mostrar: Nome, Referência, OP, Marca, Quantidade total, Quantidade já produzida (soma das marcações) e status (Em produção / Concluído).

2. Módulo de Colaboradores (cadastro)

Cadastro simples de colaboradores da empresa, com:

Nome completo

Função/cargo (ex: Costureira, Auxiliar de produção) — campo opcional

Status (Ativo/Inativo)

Tela de listagem com busca por nome.

3. Módulo de Configuração de Horários da Empresa

Preciso configurar o horário de funcionamento da empresa, dividido em janelas de marcação (por padrão de 1 em 1 hora, mas o sistema deve permitir configurar o intervalo). Exemplo:

07:00 às 08:00

08:00 às 09:00

09:00 às 10:00

(intervalo de almoço, se configurado, não gera janela de marcação)

13:00 às 14:00

... até o horário de encerramento

Essa configuração gera automaticamente a lista de horários disponíveis para marcação de produção usada no módulo 4. Deve ser possível editar essa configuração a qualquer momento (mudar hora de início, hora de término, duração do intervalo, dias de almoço/pausas).

4. Módulo de Marcação de Produção (o core do sistema)

Esta é a tela principal de uso diário. O fluxo é:

Selecionar o colaborador

Selecionar o produto/OP em produção

Selecionar uma ou mais operações daquele produto que o colaborador executou (um colaborador pode ter feito mais de uma operação no mesmo horário — por exemplo, na mesma hora das 07:00 às 08:00, fez "Barra de 2cm" e também "5 passantes")

Selecionar o horário (janela) em que essa produção ocorreu, com base nos horários configurados no módulo 3

Informar a quantidade produzida naquela operação, naquele horário

Salvar a marcação

Cada marcação de produção deve registrar: colaborador, produto/OP, operação(ões), horário (janela), quantidade produzida e data.

Regras importantes:

Um colaborador pode ter múltiplas marcações no mesmo horário, desde que sejam operações diferentes (ex: 07:00-08:00 fez 2 operações diferentes, cada uma com sua própria quantidade).

A soma das quantidades marcadas em uma operação não pode, idealmente, ultrapassar a quantidade total da OP (alertar visualmente se ultrapassar, mas não bloquear — pode haver retrabalho).

Deve ser possível editar ou excluir uma marcação feita por engano.

5. Dashboard / Relatórios

Preciso de uma tela de acompanhamento com:

Produção do dia por colaborador (quanto cada um produziu, em quais operações)

Produção por produto/OP (quanto já foi produzido do total, % de conclusão)

Filtro por data, colaborador e produto

Visualização em formato de tabela, com totais por horário (uma espécie de grade: linhas = colaboradores, colunas = horários, células = quantidade/operação)

Requisitos técnicos e de UX

Interface simples e rápida de usar, pensada para ser preenchida várias vezes ao dia (a marcação de produção deve ser o fluxo mais rápido possível: poucos cliques, seleção em dropdown/busca)

Persistir os dados (usar banco de dados do próprio Lovable/Supabase)

Layout responsivo, mas o uso principal será em desktop/tablet no chão de fábrica

Cores neutras, foco em legibilidade das tabelas e formulários

Navegação lateral com os módulos: Produtos, Operações (dentro de produtos), Colaboradores, Horários, Marcação de Produção, Dashboard

Resumo do modelo de dados sugerido

Produto: id, nome, referência, número_op, marca, quantidade_total, status

Operação: id, produto_id, nome, tempo_padrão (opcional)

Colaborador: id, nome, função, status

ConfiguraçãoHorário: id, hora_início, hora_fim, duração_janela, pausas

JanelaHorário: id (gerada a partir da configuração), hora_início, hora_fim

MarcaçãoProdução: id, colaborador_id, produto_id, operação_id, janela_horário_id, quantidade, data

Fim do prompt. Cole este texto inteiro na caixa de prompt do Lovable para iniciar o projeto.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/56474720-4044-480a-922b-55cd8d9f85e3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
