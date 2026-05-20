# Consolidação Inteligente Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestruturar a página de Consolidação Inteligente para funcionar como mesa de triagem rápida orientada por score.

**Architecture:** Manter a página em um único arquivo por enquanto, mas redistribuir o peso visual entre topo, coluna esquerda, fila central e coluna direita. A fila central vira a superfície dominante; score e valor passam a liderar a leitura; filtros e contexto ficam compactos e laterais.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Phosphor Icons, react-virtuoso.

---

### Task 1: Reequilibrar a superfície da página

**Files:**
- Modify: `C:\Users\Mac-PC\Downloads\PERCATA\web\src\app\(admin)\admin\consolidacao\page.tsx`

- [ ] **Step 1: Ajustar o topo para refletir a prioridade da tela**

Trocar o bloco de KPIs para destacar apenas o que ajuda a decidir primeiro: valor do recorte, pareto e itens exibidos. Rebaixar `DFDs aprovadas` e `Filtros ativos` para contexto secundário em texto auxiliar.

- [ ] **Step 2: Tornar o centro dominante**

Alterar a distribuição de colunas para que a lista central mantenha mais largura útil mesmo quando os painéis laterais estiverem abertos. Usar um equilíbrio do tipo `2 / 8 / 2` em telas largas.

- [ ] **Step 3: Tornar a barra central mais operacional**

Remover rótulos passivos e deixar explícito no cabeçalho que a fila está ordenada por score. Consolidar a mensagem de ordenação e os filtros ativos em chips funcionais curtos.

- [ ] **Step 4: Verificar build**

Run: `npm run lint && npm run build`
Expected: PASS

### Task 2: Compactar as laterais

**Files:**
- Modify: `C:\Users\Mac-PC\Downloads\PERCATA\web\src\app\(admin)\admin\consolidacao\page.tsx`

- [ ] **Step 1: Compactar a lista de DFDs**

Reduzir altura e ruído dos cards de DFDs, priorizando protocolo, objeto resumido, avatar, valor e quantidade de itens.

- [ ] **Step 2: Rebaixar visualmente a coluna de opções inteligentes**

Fazer a coluna direita parecer bandeja de controle, não um painel equivalente ao centro. Compactar blocos, reduzir títulos e diminuir a sensação de card empilhado.

- [ ] **Step 3: Preservar o painel lateral contextual**

Manter o painel de DFD recém-criado como profundidade sob demanda, sem recolocar o fluxo de abrir aba como ação primária.

- [ ] **Step 4: Verificar lint**

Run: `npm run lint`
Expected: PASS

### Task 3: Refinar a fila central para triagem

**Files:**
- Modify: `C:\Users\Mac-PC\Downloads\PERCATA\web\src\app\(admin)\admin\consolidacao\page.tsx`

- [ ] **Step 1: Reforçar score como primeiro sinal**

Manter score como principal bloco da linha, mas ajustar o entorno visual para que a ordem fique autoexplicativa sem depender de leitura longa.

- [ ] **Step 2: Reduzir sensação de card por item**

Aproximar visualmente a lista de uma grade operacional contínua: menos sombra, menos borda pesada e mais separação por ritmo vertical.

- [ ] **Step 3: Rebaixar metadados secundários**

Garantir que grupo/classe/tipo/GND, faixa e pendências não disputem o primeiro nível da linha.

- [ ] **Step 4: Rodar validação final**

Run: `npm run lint && npm test && npm run build`
Expected: PASS

### Task 4: Publicar

**Files:**
- Modify: `C:\Users\Mac-PC\Downloads\PERCATA\web\src\app\(admin)\admin\consolidacao\page.tsx`

- [ ] **Step 1: Commit**

```bash
git add "src/app/(admin)/admin/consolidacao/page.tsx" "docs/superpowers/plans/2026-05-20-consolidacao-inteligente-redesign.md"
git commit -m "Redesign intelligent consolidation triage layout"
```

- [ ] **Step 2: Deploy**

```bash
vercel --prod --yes
```

- [ ] **Step 3: Smoke check**

Run:

```bash
Invoke-WebRequest -Uri "https://percata.vercel.app/" -UseBasicParsing -TimeoutSec 30
Invoke-WebRequest -Uri "https://percata.vercel.app/admin/consolidacao" -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30
```

Expected:
- `/` returns `200`
- `/admin/consolidacao` returns `307` when auth redirect applies
