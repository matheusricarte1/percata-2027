# Humanizacao Da Landing E Entrada Do Produto

## Contexto

O Percata hoje ja resolve fluxos centrais de DFD, DFD coletiva, catalogo e aprovacao, mas a experiencia de entrada ainda e percebida como fria, apertada e mais burocratica do que orientadora. A landing atual e basicamente uma porta de login com presenca visual forte, mas pouco contexto. O redesenho aprovado reposiciona o sistema como uma experiencia mais humana para organizar DFDs, sem perder confianca institucional.

## Objetivo

Transformar a entrada e as primeiras superfícies do produto em um percurso mais acolhedor, guiado e legivel, equilibrando explicacao do sistema com acesso rapido ao login.

## Direcao Aprovada

- publico principal: servidores e chefias igualmente;
- prioridade da primeira dobra: equilibrio entre explicar e entrar;
- tom: institucional por fora, humano na experiencia;
- dor principal: menos confusao, mais orientacao e mais colaboracao ao mesmo tempo;
- direcao visual aprovada no companion: `B2`, com entrada mais acolhedora e acompanhamento mais explicito.

## Escopo Da Primeira Fase

### 1. Nova landing no lugar da login atual

Substituir a tela atual de entrada por uma landing completa com:

- hero acolhedor com login visivel;
- explicacao curta do que o Percata faz;
- cards distintos para servidor e chefia;
- faixa visual do fluxo ponta a ponta;
- secoes de experiencias centrais do produto;
- bloco de confianca institucional;
- CTA final repetindo o acesso com Google.

### 2. Humanizacao das primeiras superfícies do produto

Aplicar a nova linguagem visual e comportamental em:

- dashboard inicial;
- shell visual basico do produto;
- fluxo inicial de nova DFD.

### 3. Base de linguagem e feedback

Padronizar:

- textos mais explicativos e menos secos;
- blocos de proximo passo;
- guias e resumos contextuais;
- transicoes suaves com Motion;
- microinteracoes com CSS transitions.

## Fora Do Escopo Desta Fase

- reformular todas as telas de chefia, triagem, admin e catalogo profundamente;
- reestruturar o modelo de dados;
- ativar integracoes Google alem do que ja foi decidido conceitualmente;
- revisar todos os fluxos secundarios de exportacao, auditoria e configuracoes.

## Arquitetura Da Landing

### Hero

- titulo humano e claro;
- subtitulo curto;
- botao principal `Entrar com Google`;
- ancora secundaria `Entender como funciona`;
- cartoes de leitura para `Servidor` e `Chefia`.

### Fluxo Visual

Etapas:

- planejar;
- buscar itens;
- colaborar;
- revisar;
- enviar;
- acompanhar.

### Como O Sistema Ajuda

Tres pilares:

- menos confusao;
- mais orientacao;
- mais colaboracao.

### Experiencias Centrais

Apresentar:

- DFD individual;
- DFD coletiva;
- catalogo;
- acompanhamento e aprovacao.

### Confianca Institucional

- contexto UPE;
- seriedade administrativa;
- rastreabilidade e organizacao sem tom frio.

## Mudancas No Produto

### Dashboard

- hero mais acolhedor e menos executivo por padrao;
- secao nova de proximos passos;
- destaque para acoes recomendadas por momento de uso;
- textos mais guiados.

### Shell

- pequenos ajustes de linguagem e acolhimento no rail e cabecalho;
- reduzir sensacao de painel duro sem quebrar navegacao.

### Nova DFD

- reforcar o carater acompanhado do fluxo;
- explicar melhor o que acontece antes e depois do preenchimento;
- manter o guia existente, mas com linguagem mais humana.

## Integracoes Google Ja Mapeadas

Mantidas como restricao de produto, mas fora desta fase visual:

- Google Drive + Picker: somente superadmin;
- Google Sheets: somente superadmin;
- Google Calendar: para todos.

## Testes

- build, lint e testes existentes;
- validacao visual da landing;
- verificacao do dashboard e da tela de nova DFD em desktop;
- checagem de acessos principais (`/login`, `/dashboard`, `/nova-dfd`).

## Riscos

- deixar a landing bonita, mas desconectada do produto real;
- adicionar calor visual demais e perder clareza operacional;
- mudar linguagem sem coerencia com as telas internas.

## Criterio De Sucesso

Ao abrir o Percata, o usuario deve perceber:

- o que o sistema faz;
- para quem ele serve;
- onde entrar;
- qual e o fluxo principal;
- e que o sistema vai acompanha-lo ao longo da tarefa, em vez de apenas cobrar preenchimento.
