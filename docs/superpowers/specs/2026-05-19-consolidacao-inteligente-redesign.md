# Redesign da Consolidação Inteligente

Data: 2026-05-19
Escopo: `C:\Users\Mac-PC\Downloads\PERCATA\web\src\app\(admin)\admin\consolidacao\page.tsx`

## Objetivo

Transformar a tela de `Consolidação Inteligente` em uma mesa de triagem rápida para decidir o que entra primeiro no PCA.

A página não deve mais se comportar como dashboard analítico genérico. Ela deve priorizar velocidade de leitura, clareza de ordenação e contexto sob demanda.

## Decisão principal da tela

Quando alguém entra nesta página, a pergunta principal deve ser:

`quais itens entram primeiro no PCA?`

Com isso, a hierarquia funcional da tela passa a ser:

1. score
2. item
3. valor total
4. criticidade e priorização
5. origem e rastreabilidade

## Problemas da interface atual

1. Existem superfícies demais competindo pelo mesmo peso visual.
2. A ordenação por score não é óbvia.
3. A linha do item ainda parece ficha resumida, não fila de decisão.
4. Há controles que não ajudam a decidir, como rótulos passivos sem função operacional clara.
5. Parte do contexto abre nova aba ou dispersa atenção desnecessariamente.
6. Os painéis laterais ainda têm peso visual muito próximo do centro.

## Estratégia de UI/UX

Adotar o modelo:

- esquerda = origem
- centro = fila principal de decisão
- direita = ferramentas e inteligência
- laterais contextuais = aprofundamento sem sair da triagem

O centro precisa dominar visualmente. As laterais devem parecer suporte operacional, não colunas equivalentes.

## Arquitetura da tela

### 1. Faixa superior

Função:

- situar o usuário
- mostrar o recorte atual
- expor ações globais

Conteúdo:

- título da área
- subtítulo curto explicando a lógica da página
- `Atualizar`, `Exportar CSV`, `Exportar XLSX`
- métricas principais:
  - `Valor do recorte`
  - `Pareto 20%`
  - `Itens exibidos`

Métricas administrativas como `DFDs aprovadas` e `Filtros ativos` devem ser rebaixadas visualmente ou deslocadas para contexto secundário.

### 2. Coluna esquerda: DFDs enviadas

Função:

- restringir o recorte por origem
- ajudar o usuário a localizar conjuntos de demanda

Regras:

- lista escaneável e compacta
- foco em protocolo, objeto curto, valor, avatar, quantidade de itens
- sem excesso de microtexto

### 3. Centro: fila principal

Função:

- ser a superfície de decisão

Regras:

- lista operacional densa
- ordenação por score explicitada
- cada linha tratada como unidade de triagem rápida

### 4. Coluna direita: opções inteligentes

Função:

- filtros
- presets
- ajustes visuais
- simulador
- recomendações

Regras:

- aparência de bandeja de controle
- blocos mais compactos
- peso visual inferior ao centro

### 5. Painéis laterais contextuais

Função:

- aprofundar sem quebrar o fluxo

Regras:

- clique em DFD abre painel lateral contextual
- clique em item pode evoluir para painel próprio na próxima fase
- abrir nova aba só como ação explícita final

## Hierarquia da linha do item

### Bloco A: identificação

Conteúdo:

- descrição do item
- metadados mínimos
  - servidor(es)
  - local
  - número de origens
- badges de criticidade e priorização

### Bloco B: decisão

Conteúdo:

- score como sinal principal
- barra curta de score
- valor total
- quantidade

Regra:

o score deve ser o primeiro sinal visual da linha e explicar por que o item aparece naquela posição.

### Bloco C: estado de atenção

Conteúdo:

- estrela de pareto
- sinais de pendência
- acesso ao contexto lateral

### Deve sair da primeira leitura

Os seguintes elementos não devem competir no primeiro nível:

- grupo
- classe
- tipo
- GND completo
- lista detalhada de protocolos
- chips excessivos
- explicações longas

Esses dados podem existir, mas em camada secundária ou painel contextual.

## Linguagem visual

### Princípios

- menos aparência de cards independentes
- mais superfície contínua
- contraste funcional
- tipografia com hierarquia agressiva
- foco em leitura rápida

### Semântica de cor

- azul: estrutura, score, ações principais
- terracota/vermelho: criticidade
- azul frio: priorização
- dourado: pareto
- âmbar: revisão e pendência

### Tipografia

Níveis:

1. descrição do item
2. score
3. valor
4. badges e metadados
5. contexto técnico

## Comportamento

### Ordenação

A página deve deixar explícito que a lista está ordenada do maior score para o menor.

Isso deve aparecer:

- no subtítulo da área central
- em um chip ou marcador de contexto
- no tratamento visual do bloco de score

### Contexto sem fuga de fluxo

- `Ver DFD` abre painel lateral
- o usuário só abre a DFD completa se quiser aprofundar além do suficiente para a triagem

### Controles mortos

Rótulos ou blocos sem ação ou sem valor informacional claro devem ser removidos.

Exemplos:

- `Visão geral`
- `all`

## Acessibilidade

1. Áreas clicáveis grandes e previsíveis.
2. Estado de foco visível.
3. Não depender apenas de cor para expressar estado.
4. Reduzir uppercase em textos longos.
5. Garantir contraste adequado entre planos e texto.
6. Evitar densidade que sacrifique compreensão.

## Plano de implementação

### Fase 1

- reequilibrar a superfície geral
- reduzir peso das laterais
- reforçar que o centro é a fila principal
- limpar rótulos mortos

### Fase 2

- tornar score o principal bloco da linha
- reorganizar valor, quantidade e pareto
- reduzir ruído de chips e metadados

### Fase 3

- transformar o acesso a DFD em painel lateral contextual
- compactar coluna direita
- revisar coluna esquerda para leitura mais rápida

### Fase 4

- refinamento visual
- microinterações
- revisão de acessibilidade
- revisão de densidade

## Resultado esperado

Ao abrir a página, o usuário deve entender em poucos segundos:

1. que a lista está ordenada por score
2. quais itens merecem entrar primeiro no PCA
3. quanto custa cada prioridade
4. de onde a demanda veio
5. onde aprofundar sem sair da triagem
