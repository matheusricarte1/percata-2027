# Plano de Aproveitamento do CSV e-Fisco 500 MB

Data: 2026-04-29
Fonte: `catalogo_itens_efisco_ativos_17042026.csv`
Tamanho local observado: 568.986.391 bytes

## Campos recebidos no CSV

O arquivo possui 17 colunas:

- `CODIGO_GRUPO`
- `NOME_GRUPO`
- `DESCRICAO_GRUPO`
- `SITUACAO_GRUPO`
- `CODIGO_CLASSE`
- `NOME_CLASSE`
- `DESCRICAO_CLASSE`
- `SITUACAO_CLASSE`
- `CODIGO_MATERIAL_SERVICO`
- `NOME_MATERIAL_SERVICO`
- `SITUACAO_MATERIAL_SERVICO`
- `TIPO_OBJETO`
- `CODIGO_ITEM`
- `NOME_ITEM`
- `DATA_INCLUSAO_ITEM`
- `SITUACAO_ITEM`
- `CODIGO_NATUREZA_DESPESA`

## Leitura de produto

Faz sentido o PERCATA deixar de tratar o catalogo apenas como uma lista plana de itens.

A taxonomia correta e:

```text
Grupo -> Classe -> Material/Servico -> Item -> Natureza de despesa
```

Isso permite que uma DFD seja orientada por familia de necessidade, e nao apenas por itens soltos.

Exemplo pratico:

- Grupo: servicos imobiliarios ou locacao;
- Classe: locacao de imoveis;
- Item: locacao de imovel especifica;
- Natureza: despesa correspondente.

## Modelo recomendado para DFDs

### Recomendacao principal

Criar DFDs agrupadas por `CODIGO_GRUPO` ou `CODIGO_CLASSE`, com os itens dentro desses blocos.

O melhor desenho operacional e:

- se o carrinho tiver itens de um unico grupo, criar uma DFD unica com secoes por classe;
- se o carrinho tiver itens de grupos diferentes, sugerir separacao automatica em uma DFD por grupo;
- dentro de cada DFD, agrupar visualmente e tecnicamente por classe;
- manter cada item individual para quantidade, valor, link de referencia e justificativas.

Isso evita DFDs misturadas, melhora triagem e facilita consolidacao PCA.

### Nova entidade sugerida

Criar uma tabela de agrupamentos da DFD:

```sql
dfd_grupos (
  id uuid primary key,
  dfd_id uuid references dfds(id) on delete cascade,
  agrupamento_tipo text not null, -- grupo | classe | material_servico
  codigo_grupo text,
  nome_grupo text,
  codigo_classe text,
  nome_classe text,
  codigo_material_servico text,
  nome_material_servico text,
  tipo_objeto text,
  codigo_natureza_preferencial text,
  gnd_preferencial text,
  justificativa_grupo text,
  subtotal_estimado numeric,
  item_count integer default 0,
  created_at timestamptz default now()
)
```

Adicionar em `dfd_items`:

```sql
dfd_grupo_id uuid references dfd_grupos(id) on delete set null
```

## Como aproveitar cada campo

| Campo | Uso no PERCATA |
|---|---|
| `CODIGO_GRUPO` | chave do agrupamento macro, filtros, DFD por grupo |
| `NOME_GRUPO` | titulo do agrupamento e texto de DFD |
| `DESCRICAO_GRUPO` | ajuda contextual e sugestao de justificativa |
| `SITUACAO_GRUPO` | filtro de elegibilidade |
| `CODIGO_CLASSE` | agrupamento operacional dentro da DFD |
| `NOME_CLASSE` | titulo de secao e filtro principal |
| `DESCRICAO_CLASSE` | texto de apoio para especificacao |
| `SITUACAO_CLASSE` | filtro de elegibilidade |
| `CODIGO_MATERIAL_SERVICO` | familia mais especifica para consolidacao |
| `NOME_MATERIAL_SERVICO` | nome de subgrupo tecnico |
| `SITUACAO_MATERIAL_SERVICO` | filtro de elegibilidade |
| `TIPO_OBJETO` | separacao material/servico |
| `CODIGO_ITEM` | codigo oficial do item e-Fisco |
| `NOME_ITEM` | descricao oficial do item |
| `DATA_INCLUSAO_ITEM` | auditoria e recencia do cadastro |
| `SITUACAO_ITEM` | filtro para impedir item inativo |
| `CODIGO_NATUREZA_DESPESA` | natureza/GND e validacao orcamentaria |

## Arquitetura de dados recomendada

Manter duas camadas:

### 1. Camada denormalizada de busca

Tabela atual `catalogo` continua sendo boa para busca rapida.

Ela deve manter:

- codigo do item;
- nome do item;
- grupo;
- classe;
- material/servico;
- tipo;
- natureza preferencial;
- GND derivado;
- contagem de naturezas.

### 2. Camada normalizada fiscal

Criar tabelas normalizadas:

- `catalogo_grupos`
- `catalogo_classes`
- `catalogo_material_servicos`
- `catalogo_itens`
- `catalogo_item_naturezas`
- opcional: `catalogo_efisco_raw_imports` para auditoria de carga.

Isso reduz duplicacao do CSV e permite filtros robustos.

## Fluxo de usuario proposto

### Catalogo

- Busca textual continua existindo.
- Adicionar filtros laterais por:
  - tipo objeto;
  - grupo;
  - classe;
  - material/servico;
  - GND/natureza.
- Resultado deve mostrar hierarquia:

```text
Grupo > Classe > Material/Servico
Codigo item - Nome item
Natureza preferencial / GND
```

### Carrinho

O carrinho deve agrupar automaticamente:

```text
Grupo
  Classe
    Item
```

Ao criar a DFD:

- se houver um grupo: criar uma DFD;
- se houver varios grupos: oferecer "Criar DFDs separadas por grupo";
- se houver varias classes no mesmo grupo: manter secoes dentro da mesma DFD.

### Nova DFD

Adicionar modo de composicao:

- `DFD unica`
- `Separar por grupo`
- `Separar por classe`

Padrao recomendado:

- separar por grupo quando houver grupos distintos;
- agrupar por classe dentro de cada DFD.

## Impacto na triagem

Com agrupamentos, a chefia passa a avaliar:

- valor por grupo;
- criticidade por classe;
- itens repetidos na mesma classe;
- natureza de despesa dominante;
- consolidacao por codigo de material/servico.

Isso melhora a priorizacao e evita que uma DFD grande esconda itens de familias completamente diferentes.

## Fases de implementacao

### Fase 1 - Fundacao de dados

- Criar tabelas normalizadas do catalogo.
- Criar importador streaming com staging.
- Registrar hash/contagem da carga.
- Validar duplicidades por `CODIGO_ITEM` e multiplas naturezas.

### Fase 2 - Agrupamento na DFD

- Criar `dfd_grupos`.
- Vincular `dfd_items.dfd_grupo_id`.
- Ao salvar DFD, criar grupos/classes automaticamente a partir dos itens.
- Preservar snapshot fiscal completo no item.

### Fase 3 - UX do carrinho e nova DFD

- Mostrar carrinho agrupado por grupo/classe.
- Adicionar opcao de gerar DFDs por grupo.
- Gerar objeto/justificativa sugeridos com base em `NOME_GRUPO`, `NOME_CLASSE` e itens.

### Fase 4 - Triagem e consolidacao

- Criar visao de triagem por grupo/classe.
- Mostrar subtotal por grupo.
- Permitir aprovar/devolver grupo ou classe.
- Consolidar PCA por grupo, classe, material/servico e natureza.

### Fase 5 - Busca e analytics

- Facetas de busca por grupo/classe.
- Ranking por match em grupo/classe antes de descricao longa.
- Dashboard de consumo planejado por grupo/classe/GND.

## Riscos

- Uma DFD por grupo pode gerar muitas DFDs se o usuario adicionar itens muito heterogeneos.
- Uma DFD unica com muitos grupos prejudica objeto da contratacao.
- Natureza de despesa pode variar por item; nao deve ser fixada apenas pelo grupo.
- Descricoes oficiais sao longas e devem ser preservadas, mas nao podem dominar a UI.
- O CSV de 500 MB nao deve ser processado no browser; importacao deve ser sempre server-side/streaming.

## Decisao recomendada

Implementar `DFD por grupo` como comportamento assistido:

- o sistema detecta grupos diferentes no carrinho;
- sugere separar;
- o usuario confirma;
- cada DFD nasce com secoes por classe e itens preservados;
- a triagem e a consolidacao passam a operar tambem por agrupamento.

