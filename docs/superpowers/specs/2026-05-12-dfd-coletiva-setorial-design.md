# DFD Coletiva Setorial Design

## Contexto

O fluxo atual permite criar uma DFD coletiva a partir do carrinho, mas a experiencia nao oferece uma sala setorial aberta onde varios usuarios possam ver, adicionar e acompanhar contribuicoes antes da chefia gerar a DFD oficial. A nova funcionalidade cria salas coletivas tematicas por setor para colaboracao assincrona.

## Objetivo

Permitir que membros de um mesmo setor criem salas coletivas tematicas, adicionem itens em conjunto, acompanhem participantes com nome e foto/avatar, e deixem a chefia revisar e converter a sala em uma ou mais DFDs oficiais.

## Escopo Aprovado

- O modelo sera de varias salas coletivas por tema, nao uma sala unica por setor.
- Qualquer membro vinculado ao setor pode criar uma sala tematica.
- A sala nasce aberta para colaboracao imediatamente.
- A chefia pode editar titulo, descricao e escopo da sala.
- Todos os membros vinculados ao mesmo setor podem adicionar itens.
- O usuario pode adicionar itens pelo catalogo/carrinho ou por busca de catalogo dentro da propria sala.
- Itens iguais sao agrupados automaticamente, com total consolidado e distribuicao por usuario.
- A distribuicao deve exibir nome e foto/avatar do usuario quando disponivel.
- Apenas a chefia pode gerar a DFD oficial.
- Ao gerar a DFD oficial, o sistema separa automaticamente por natureza da despesa quando necessario, por exemplo custeio e investimento.
- A sala convertida fica somente leitura e vinculada a todas as DFDs oficiais geradas.

## Status Das Salas

- `aberta`: membros do setor podem adicionar itens e editar/remover suas proprias contribuicoes.
- `em_revisao`: chefia esta revisando; membros visualizam, mas nao editam.
- `convertida`: somente leitura, com vinculo para uma ou mais DFDs oficiais.
- `arquivada`: sai da lista principal, mas permanece no historico.

## Permissoes

Membro do setor:

- pode criar sala para unidades as quais esta vinculado;
- pode ver salas abertas/em revisao/convertidas/arquivadas do seu setor;
- pode adicionar contribuicoes em salas `aberta`;
- pode editar ou remover apenas suas proprias contribuicoes em salas `aberta`;
- nao pode gerar DFD oficial.

Chefia do setor:

- pode ver todas as salas do setor;
- pode editar titulo, descricao e escopo;
- pode mudar status entre `aberta`, `em_revisao` e `arquivada`;
- pode editar/remover qualquer contribuicao com registro no historico;
- pode gerar DFD oficial;
- apos geracao, a sala muda para `convertida`.

Admin/superadmin:

- pode visualizar e auditar salas;
- pode acessar exportacoes e vinculos gerados;
- superadmin preserva visao transversal conforme o padrao existente do sistema.

## Experiencia Do Usuario

### Lista de Salas Coletivas

Criar uma tela em Meu Espaco, por exemplo `/dfds-coletivas`, com:

- filtros por setor, status e termo de busca;
- cards ou lista densa de salas com tema, setor, status, contagem de participantes, contagem de itens, valor estimado e data de atualizacao;
- acao para criar nova sala;
- destaque de salas em que o usuario ja contribuiu.

### Criacao de Sala

Formulario simples:

- titulo;
- descricao;
- escopo/orientacao;
- setor/unidade;
- ciclo;
- status inicial `aberta`.

O setor deve ser escolhido entre os vinculos do usuario. A chefia pode ajustar os textos posteriormente.

### Detalhe da Sala

A tela da sala deve mostrar:

- cabecalho com titulo, setor, status e controles;
- descricao e escopo editaveis pela chefia;
- participantes com avatar, nome, quantidade de itens e total solicitado;
- itens agrupados por item/GND/natureza, mostrando total consolidado;
- drawer ou painel de detalhes com contribuicoes por usuario;
- historico de eventos;
- area de busca de catalogo para adicionar item;
- acoes de revisao e conversao para chefia.

### Adicao Pelo Catalogo/Carrinho

No fluxo de catalogo/carrinho, adicionar uma acao para enviar itens selecionados para uma sala coletiva:

- selecionar sala aberta do setor;
- confirmar quantidades, valor, justificativa e link de referencia;
- gravar contribuicoes na sala;
- manter o fluxo atual de criar DFD individual intacto.

## Modelo De Dados

Adicionar tabela `dfd_collective_rooms`:

- `id uuid primary key`;
- `title text not null`;
- `description text`;
- `scope text`;
- `status text not null` com valores `aberta`, `em_revisao`, `convertida`, `arquivada`;
- `unit_id uuid not null`;
- `unit_type text not null` com `departamento` ou `laboratorio`;
- `campus_id uuid`;
- `created_by uuid not null`;
- `cycle_year integer not null`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`;
- `converted_at timestamptz`;

Reutilizar e evoluir `dfd_collective_contributions`:

- adicionar `room_id uuid references dfd_collective_rooms(id)`;
- manter `unit_id`, `unit_type`, `user_id`, dados de item, quantidade, valor, justificativa, link e status;
- manter `consolidated_dfd_id` para compatibilidade, mas permitir uma sala gerar varias DFDs por meio de tabela de vinculo.

Adicionar tabela `dfd_collective_room_dfds`:

- `room_id uuid references dfd_collective_rooms(id)`;
- `dfd_id uuid references dfds(id)`;
- `expense_class text`;
- `created_at timestamptz not null`;
- chave unica por `room_id, dfd_id`.

Adicionar tabela `dfd_collective_room_events`:

- `id uuid primary key`;
- `room_id uuid not null`;
- `actor_id uuid`;
- `event_type text not null`;
- `message text not null`;
- `metadata jsonb`;
- `created_at timestamptz not null`.

## Regras De Agrupamento

Itens iguais devem ser agrupados por:

- codigo e-Fisco/TCE quando existir;
- natureza da despesa/GND;
- descricao normalizada como fallback.

O total consolidado soma quantidades por grupo. O valor unitario consolidado usa o maior valor informado, preservando as contribuicoes originais para auditoria. A visualizacao de participantes mostra avatar, nome, e-mail quando autorizado, quantidade e justificativa individual.

## Conversao Em DFD Oficial

Ao clicar em Gerar DFD oficial:

1. validar que o usuario e chefia da unidade;
2. carregar contribuicoes ativas da sala;
3. agrupar itens por natureza da despesa;
4. criar uma DFD oficial por grupo de natureza quando necessario;
5. criar os itens consolidados em `dfd_items`;
6. registrar vinculos em `dfd_collective_room_dfds`;
7. marcar a sala como `convertida`;
8. registrar evento de conversao;
9. exibir links para as DFDs geradas.

## Rotas E APIs

Rotas de UI previstas:

- `/dfds-coletivas`: lista de salas do usuario/setor;
- `/dfds-coletivas/[id]`: detalhe da sala;
- adicionar link no menu Meu Espaco para membros e no menu Chefia para chefias.

APIs previstas:

- `GET /api/collective-rooms`: lista salas visiveis ao usuario;
- `POST /api/collective-rooms`: cria sala aberta;
- `GET /api/collective-rooms/[id]`: detalhe, itens agregados e participantes;
- `PATCH /api/collective-rooms/[id]`: chefia atualiza titulo, descricao, escopo ou status;
- `POST /api/collective-rooms/[id]/contributions`: adiciona contribuicao;
- `PATCH /api/collective-rooms/[id]/contributions/[contributionId]`: edita contribuicao permitida;
- `DELETE /api/collective-rooms/[id]/contributions/[contributionId]`: remove contribuicao permitida;
- `POST /api/collective-rooms/[id]/convert`: chefia gera DFD oficial.

## Erros E Estados Vazios

- Sem setor vinculado: orientar usuario a procurar administracao.
- Sala sem itens: mostrar busca de catalogo e CTA para adicionar.
- Usuario sem permissao: bloquear com mensagem clara e sem vazar dados de outra unidade.
- Sala em revisao/convertida/arquivada: controles de edicao ficam desabilitados com explicacao.
- Conversao sem itens: impedir e solicitar contribuicoes.
- Itens sem GND: separar como `sem-gnd` e exigir revisao da chefia antes da conversao.

## Testes

Testes unitarios:

- permissao de membro/chefia/admin por unidade;
- agrupamento de contribuicoes com distribuicao por usuario;
- separacao por natureza da despesa;
- validacao de status editavel/somente leitura;
- conversao de sala em uma ou mais DFDs.

Testes de integracao/API:

- membro cria sala;
- membro adiciona contribuicao;
- membro nao edita contribuicao de outro usuario;
- chefia edita escopo e contribuicao;
- chefia converte sala em DFD;
- sala convertida fica somente leitura.

QA visual:

- lista de salas em desktop e mobile;
- detalhe com muitos participantes;
- fluxo de adicionar item pela sala;
- fluxo pelo catalogo/carrinho;
- conversao pela chefia.

## Fora Do Escopo Inicial

- Chat em tempo real dentro da sala.
- Comentarios por item.
- Aprovacao previa da chefia para abertura da sala.
- Convites manuais por usuario.
- Mesclagem automatica de salas duplicadas.
- Notificacoes em tempo real nao fazem parte desta entrega. Notificacoes assincronas pelo mecanismo existente serao tratadas em uma especificacao separada se forem priorizadas.

## Decisoes Registradas

- A opcao escolhida foi varias salas por tema.
- A sala nao exige aprovacao previa da chefia para abrir.
- A chefia pode modificar descricao e escopo.
- Todos os membros do setor podem adicionar itens.
- Entrada de itens existira tanto pelo catalogo/carrinho quanto dentro da sala.
- Itens iguais serao agrupados automaticamente com detalhes por usuario.
- Participantes devem exibir nome e foto/avatar.
- Sala convertida fica somente leitura e vinculada as DFDs oficiais.
- Separacao por custeio/investimento sera automatica na conversao.
