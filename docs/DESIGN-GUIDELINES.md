# PERCATA 2027 Design Guidelines (Formal)

Este documento formaliza as regras de design que devem ser seguidas no sistema.

## 1. Regra de Cores 60/30/10

A distribuição visual da interface deve respeitar:

1. 60%: base neutra de leitura (fundos e superfícies principais).
2. 30%: cor institucional de estrutura (navegação, blocos de contexto, headers de área).
3. 10%: cor de ação e destaque (CTAs, estados críticos, indicadores de atenção).

Tokens oficiais em `:root` (`src/app/globals.css`):

- `--ds-color-60`
- `--ds-color-30`
- `--ds-color-10`
- `--ds-color-alert`

Mapeamento de semântica no tema:

- `--color-role-base`
- `--color-role-support`
- `--color-role-accent`

## 2. Grade de 4px (Espaço e Tipografia)

Todo novo desenvolvimento deve usar múltiplos de 4px para:

1. padding e margin
2. gap e distanciamentos
3. tamanhos tipográficos e line-height

Exceções permitidas:

1. bordas/hairlines de 1px
2. efeitos visuais técnicos (sombra, blur, divisores finos, indicadores pontuais)

Tokens oficiais em `:root` (`src/app/globals.css`):

- Espaçamento: `--ds-space-1`, `--ds-space-2`, `--ds-space-3`, `--ds-space-4`, `--ds-space-5`, `--ds-space-6`, `--ds-space-8`, `--ds-space-10`
- Tipografia: `--ds-font-size-12`, `--ds-font-size-16`, `--ds-font-size-20`, `--ds-font-size-24`, `--ds-font-size-32`
- Altura de linha: `--ds-line-height-16`, `--ds-line-height-20`, `--ds-line-height-24`, `--ds-line-height-28`, `--ds-line-height-40`

Utilitários base:

- `.text-ds-xs`
- `.text-ds-sm`
- `.text-ds-md`
- `.text-ds-lg`

## 3. Política Tipográfica

Diretrizes mandatórias:

1. Não usar itálico em UI (`italic`).
2. Evitar pesos extremos (`font-black`, `font-extrabold`).
3. Priorizar hierarquia com `font-medium`, `font-semibold` e `font-bold`.

Objetivo:

1. Melhorar legibilidade.
2. Reduzir ruído visual em telas operacionais.
3. Garantir consistência entre perfis (Solicitante, Chefia, Admin e Superadmin).

## 4. Governança de Implementação

Regras de PR:

1. Novos componentes não podem introduzir `text-[10px]`, `text-[11px]`, `gap-1.5`, `px-1.5` e variações fora da grade de 4px.
2. Qualquer novo fluxo deve usar as cores semânticas do guideline 60/30/10.
3. Novos componentes não podem introduzir `italic`, `font-black` ou `font-extrabold`.
4. Mudanças em layout compartilhado (`Sidebar`, `UserNav`, `globals.css`) devem preservar aderência às diretrizes.

## 5. Status de Adoção

Esta formalização foi aplicada de imediato nos elementos compartilhados do shell da aplicação:

1. `src/app/globals.css`
2. `src/components/layout/Sidebar.tsx`
3. `src/components/layout/UserNav.tsx`
4. layouts com largura da rail principal em 100px (incluindo chefia)
5. normalização tipográfica aplicada em `src/` (remoção de itálico e pesos extremos)

As telas de domínio já existentes devem continuar migração gradual para o padrão, sem regressão funcional.
