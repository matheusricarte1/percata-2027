# Plano de remoção do MUI e Material Web

**Status:** Plano. Execução requer sprint dedicada (~1 semana) e regressão visual completa.
**Autor:** Claude (revisão dialética PERCATA, 2026-05-24)
**Pré-requisito:** patches da Onda 4 já aplicados (`theme/tokens.css`, `lib/use-reduced-motion.ts`, `lib/use-focus-trap.ts`, Dialog + Button + Sonner consolidados).

---

## Por quê

Coexistem hoje 4 sistemas visuais:

| Sistema | Pacotes | Bundle aprox. | Uso real |
|---|---|---|---|
| MUI 9 | `@mui/material`, `@mui/icons-material`, `@mui/lab`, `@mui/system`, `@mui/material-nextjs`, `@mui/utils`, `@emotion/*` | ~750 KB gzip | ThemeProvider + InitColorSchemeScript + ícones esparsos |
| Material Web | `@material/web`, `@material/material-color-utilities` | ~200 KB | `import "@material/web/all.js"` em AppProviders (carrega tudo, usa quase nada) |
| shadcn/ui | `@base-ui/react` + Tailwind | ~80 KB | Maioria dos componentes (Button, Dialog, Input, Table, Tabs, etc.) |
| Tailwind 4 | `tailwindcss`, `tw-animate-css` | ~30 KB | Utilities |

**MUI + Material Web somam ~950 KB** de JS gzip que **duplicam funcionalidade** já presente em shadcn. Tokens divergem (`--md-*` vs `--upe-*` vs `--p-*`), dark mode tem 3 fontes de verdade, e existe 1 paleta CSS por sistema.

Após patches da Onda 4, **`theme/tokens.css` já é a fonte canônica** — só falta cortar os consumers.

---

## Inventário de uso de MUI

Antes de remover, **mapear todas as ocorrências**:

```bash
# Componentes MUI usados
rg "from \"@mui/material" -l
# Ícones MUI usados
rg "from \"@mui/icons-material" -l
# Theme MUI
rg "ThemeProvider|createTheme|InitColorSchemeScript" -l
# Material Web
rg "@material/web" -l
```

Resultado esperado (baseado na revisão):
- `src/components/providers/AppProviders.tsx` — `ThemeProvider`, `CssBaseline`, `AppRouterCacheProvider`, `import "@material/web/all.js"`
- `src/app/layout.tsx` — `InitColorSchemeScript`
- `src/theme/materialYouTheme.ts` — `createTheme` (será deletado)
- Demais arquivos: ícones soltos + componentes ad-hoc (verificar caso a caso)

---

## Fases

### Fase 1 — Inventário e tradução (~1 dia)

1. Rodar os greps acima e compilar lista exata.
2. Para cada componente MUI em uso, escolher equivalente:

   | MUI | Substituto |
   |---|---|
   | `Button` | `@/components/ui/button` (já existe) |
   | `Dialog`/`DialogContent`/`DialogTitle` | `@/components/ui/dialog` (já existe) |
   | `TextField` | `@/components/ui/input` + `<label>` |
   | `Select` | shadcn `Select` (instalar via `npx shadcn add select`) |
   | `Chip` | `@/components/ui/badge` |
   | `IconButton` | `Button` size="icon" |
   | `Tooltip` | `@/components/ui/tooltip` (já em providers) |
   | `Switch` | `@/components/ui/switch` (já existe) |
   | `Tabs` | `@/components/ui/tabs` (já existe) |
   | `Table` | `@/components/ui/table` (já existe) |
   | `Snackbar` | `sonner` toast (já em uso) |
   | `Skeleton` | `@/components/ui/skeleton` (já existe) |
   | `Card` | `@/components/ui/card` (já existe) |
   | `Drawer` | shadcn `Sheet` (instalar) |
   | `Menu`/`MenuItem` | `@/components/ui/dropdown-menu` (já existe) |
   | `LinearProgress`/`CircularProgress` | `@/components/ui/progress` + `Loader2 className="animate-spin"` |

3. Para **ícones**: substituir `@mui/icons-material/*` por `lucide-react` (já em deps) ou `@phosphor-icons/react` (já em deps). Há ~20 ícones MUI espalhados — busca/replace simples.

### Fase 2 — Refactor file-by-file (~3 dias)

Trabalhar em PRs pequenas (1 arquivo por commit) com regressão visual:

```bash
# Antes de cada PR:
git status  # garantir clean
# Trocar imports
# Rodar:
npx tsc --noEmit
npm run dev # validar visualmente
```

**Ordem recomendada** (do menos para o mais usado):
1. Páginas com 1-2 imports MUI primeiro (mais fácil reverter)
2. Layouts e providers por último
3. `materialYouTheme.ts` deletado por último

### Fase 3 — Remover wrappers (~0.5 dia)

Editar `src/components/providers/AppProviders.tsx`:

```diff
- import { ThemeProvider } from "@mui/material/styles";
- import CssBaseline from "@mui/material/CssBaseline";
- import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
- import "@material/web/all.js";
- import { materialYouTheme } from "@/theme/materialYouTheme";
  // ... resto sem ThemeProvider/CssBaseline
```

Editar `src/app/layout.tsx`:

```diff
- import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
  // ... sem <InitColorSchemeScript>
```

O dark mode passa a ser controlado 100% por `html[data-theme-mode]` (gerenciado pelo `applyStoredSettings` que já existe em AppProviders, lendo localStorage).

### Fase 4 — Limpar dependências (~10 min)

```bash
npm uninstall @mui/material @mui/icons-material @mui/lab @mui/system \
  @mui/material-nextjs @mui/utils \
  @emotion/cache @emotion/react @emotion/styled \
  @material/web @material/material-color-utilities \
  @fontsource/roboto next-themes
# next-themes só era usado pelo Sonner; após Onda 4 ele já lê dataset direto.
```

Manter `@fontsource/outfit` (usado em CSS).

Deletar:
- `src/theme/materialYouTheme.ts`
- Qualquer arquivo só com import de MUI

### Fase 5 — Validar (~0.5 dia)

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
# Bundle analyzer:
ANALYZE=true npm run build  # se configurado
```

Comparar bundle antes/depois (esperado: -800KB a -1MB gzip).

Regressão visual em rotas críticas:
- `/dashboard` (todos os 4 papéis)
- `/nova-dfd` (wizard inteiro)
- `/triagem` (modal + batch sheet)
- `/admin/usuarios`
- `/login` + `/auth/callback`
- `/onboarding`
- `/dfd/[id]/impressao` (PDF — verificar fontes)

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Tema dark some em alguma página | `tokens.css` cobre todos os tokens semânticos; testar uma página por vez |
| Fonte Outfit não carrega | Manter `@fontsource/outfit` no package; ele já é referenciado em `--p-font-display` |
| Componente MUI escondido em fluxo raro (ex: print PDF) | Inventário com `rg` cobre o repo inteiro; rodar a build e abrir cada rota |
| `useTheme` quebra Sonner | Já tratado na Onda 4 — Sonner lê dataset direto |
| Ícones diferentes alinhamento/tamanho | Phosphor e Lucide têm padrões diferentes de stroke; preferir Phosphor (já dominante) |

---

## Ganhos esperados

- **Bundle:** -800 KB a -1 MB gzip (medido após Fase 5).
- **Manutenção:** 1 fonte de tema (tokens.css) em vez de 4.
- **Dark mode:** 1 dono (`data-theme-mode`).
- **DX:** ESLint/TS mais rápido (menos types para resolver).
- **Tempo de build:** estimativa ~15% mais rápido (menos transforma Emotion).

---

## Não fazer

- ❌ Remover MUI numa única PR. Pode quebrar 20 telas silenciosamente.
- ❌ Substituir Phosphor por Lucide (manter Phosphor, é o dominante).
- ❌ Mexer em Framer Motion ou GSAP — esses são ortogonais ao MUI.
- ❌ Renomear tokens `--p-*` antes da Fase 5 — quebraria os mappings de compat em `tokens.css`.
