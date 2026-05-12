# TODO Mestre Validado — Conversa Completa (24/04/2026)

## Como este checklist foi validado
- Baseado no histórico completo desta conversa + inspeção do código atual.
- Validado em código/rotas/migrations locais no workspace.
- Build e lint executados com sucesso em `24/04/2026` via `npm run deploy:check`.

Legenda de status:
- `✅ Concluído (validado em código)`
- `🟡 Parcial (implementado, mas falta fechamento/ajuste)`
- `🔴 Pendente (não implementado)`
- `⛔ Dependência externa (Supabase/infra/dados de produção)`

---

## 1) Acesso, login e sessão
1. `✅` Login apenas Google (sem senha local). Evidência: `src/app/page.tsx`.
2. `✅` Botão usa fluxo padrão “Sign in with Google”. Evidência: `src/app/page.tsx`.
3. `✅` Forçar seletor de conta Google (`prompt=select_account consent`). Evidência: `src/app/page.tsx`.
4. `✅` Logout único no menu superior. Evidência: `src/components/layout/UserNav.tsx`, `src/components/layout/Sidebar.tsx`.
5. `✅` Signout global para evitar reaproveitar sessão anterior. Evidência: `src/components/layout/UserNav.tsx`.
6. `✅` Restrição de acesso para `@upe.br` ou e-mail previamente listado. Evidência: `src/app/auth/callback/route.ts`.
7. `🟡` Regra de lista no middleware não inclui `legacy_user_profile_links` (callback inclui). Evidência: `middleware.ts`, `src/app/auth/callback/route.ts`.
8. `🟡` Erro de lock de token Supabase (“request stole it”) não tem mitigação dedicada no cliente. Evidência: sem handler específico no auth client.

## 2) Perfis, níveis e governança de usuários
9. `✅` Superadmin institucional fixo (`matheus.ricarte@upe.br`). Evidência: `src/lib/access.ts`.
10. `✅` Superadmin com visão de menus de solicitante + chefia + admin. Evidência: `src/components/layout/Sidebar.tsx`.
11. `✅` Atribuição de papel (chefia/admin/solicitante) via módulo de usuários. Evidência: `src/app/api/admin/users/manage/route.ts`.
12. `✅` Convite de novos usuários (não legados) via API. Evidência: `src/app/api/admin/users/invite/route.ts`.
13. `✅` Trilha de auditoria para ações administrativas. Evidência: `src/app/api/admin/users/audit/route.ts`, migration `20260423201000_admin_user_audit_logs.sql`.
14. `🟡` Auditoria com fallback quando tabela não existe (ok), mas depende migration aplicada no banco alvo. Evidência: rotas `audit/manage/invite`.
15. `✅` Perfil do usuário em popup com foto, nome, setor e laboratório. Evidência: `src/components/layout/UserNav.tsx`.
16. `✅` Sincronização de identidade Google (nome/foto/e-mail) no callback. Evidência: `src/app/auth/callback/route.ts`.

## 3) Onboarding (UX e vínculo organizacional)
17. `✅` Onboarding centralizado com fundo desfocado e interface única. Evidência: `src/app/(auth)/onboarding/page.tsx`.
18. `✅` Superadmin alterna campus no onboarding. Evidência: `src/app/(auth)/onboarding/page.tsx`.
19. `✅` Departamento com seleção única. Evidência: `src/app/(auth)/onboarding/page.tsx`.
20. `✅` Laboratórios com seleção múltipla e busca. Evidência: `src/app/(auth)/onboarding/page.tsx`.
21. `✅` Texto corrigido para “laboratórios aos quais você se vincula”. Evidência: `src/app/(auth)/onboarding/page.tsx`.
22. `✅` Reset de onboarding por admin (exceto superadmin protegido). Evidência: `src/app/api/admin/users/manage/route.ts`.
23. `🟡` Estratégia para “muitos cards” migrada para lista filtrável (boa), mas ainda precisa teste formal com usuários reais. Evidência: onboarding + ausência de relatório UX formal.

## 4) Shell, sidebar e consistência global
24. `✅` Sidebar estilo cinza (Teams-like), largura `100px`. Evidência: `src/components/layout/Sidebar.tsx`, `src/app/globals.css`.
25. `✅` Sidebar sem subtítulo por item. Evidência: `src/components/layout/Sidebar.tsx`.
26. `✅` Separação visual por blocos de papel com divisores/setas. Evidência: `src/components/layout/Sidebar.tsx`.
27. `✅` Seção de Ajustes presente por contexto (`/configuracoes`, `/triagem/configuracoes`, `/admin/configuracoes`). Evidência: `Sidebar.tsx` + rotas.
28. `✅` Scrollbar da sidebar escondida. Evidência: `.sidebar-scroll` em `src/app/globals.css`.
29. `🟡` Relato de “piscar/refresh constante” em navegação ainda requer profiling no browser real (não há fix dedicado anti-flicker por métrica). Evidência: ausência de benchmark de navegação.

## 5) Catálogo e carrinho
30. `✅` Correção de seleção por card (não seleciona tudo ao mesmo tempo). Evidência: `cartCodeSet`/`inCart` em `src/app/(dashboard)/catalogo/page.tsx`.
31. `✅` Código e-Fisco destacado no card. Evidência: `catalogo/page.tsx`.
32. `✅` Carrinho lateral full-height (drawer) com overlay. Evidência: `catalogo/page.tsx`.
33. `✅` Feedback animado ao adicionar item (+partículas + chip voando + shake). Evidência: `catalogo/page.tsx`.
34. `✅` Carrinho permite alterar quantidade, unidade, valor e justificativa do item. Evidência: `catalogo/page.tsx`.
35. `✅` Lista fechada de unidade (`UN/CX/PCT/...`). Evidência: `UNIT_OPTIONS` em `catalogo/page.tsx`.
36. `✅` Bloqueio de avanço sem campos obrigatórios no carrinho. Evidência: `cartBlockingSummary` em `catalogo/page.tsx`.
37. `✅` Cards do carrinho com leve diferenciação amarelo claro. Evidência: classes `bg-[#FFFDF2]`/`bg-[#FFFBEB]` em `catalogo/page.tsx`.
38. `🟡` Ainda existem cores roxas no catálogo (partículas/chips). Evidência: `rgba(103,80,164...)` e `#D0BCFF` em `catalogo/page.tsx`.

## 6) Nova DFD e fluxo de criação
39. `✅` Agrupamento automático por classe e geração de 1 DFD por classe. Evidência: `normalizeClasse` + `byClasse` em `src/app/(dashboard)/nova-dfd/page.tsx`.
40. `✅` Campo “Local de uso” no lugar de “Unidade requisitante”. Evidência: `nova-dfd/page.tsx`.
41. `✅` Validação de data mínima para ano seguinte. Evidência: `NEXT_YEAR_MIN_DATE` em `nova-dfd/page.tsx`.
42. `✅` Validação de link (somente URL válida http/https). Evidência: `isValidReferenceLink` em `nova-dfd/page.tsx`.
43. `✅` Validações obrigatórias de item e DFD antes de finalizar. Evidência: `blockingErrors` em `nova-dfd/page.tsx`.
44. `✅` Proteção para `campus`/`numero_protocolo`/`gnd` ao inserir. Evidência: insert em `dfds` e `dfd_items` em `nova-dfd/page.tsx`.
45. `✅` Modal explicando fluxo ao finalizar rascunhos. Evidência: `Dialog` em `nova-dfd/page.tsx`.
46. `✅` Texto explicando diferença entre justificativa da DFD e justificativa do item. Evidência: bloco explicativo em `nova-dfd/page.tsx`.
47. `🟡` Caso pontual “setor não veio preenchido” precisa reteste com dados reais e vínculos reais. Evidência: lógica depende de `user_units` + `unidade_id`.

## 7) Triagem (chefia)
48. `✅` Priorização global com Pareto separado da hierarquização. Evidência: `src/app/(chefia)/triagem/page.tsx`.
49. `✅` Níveis renomeados: Essencial/Relevante/Oportuno/Postergado. Evidência: `MOSCOW_OPTIONS` em `triagem/page.tsx`.
50. `✅` Bloqueio Pareto 20% com mensagem explícita por DFD. Evidência: validação `dfdOverPareto` em `triagem/page.tsx`.
51. `✅` Mensagem exigindo preenchimento de hierarquização antes de homologar. Evidência: validações em `triagem/page.tsx`.
52. `✅` Intro da tela de hierarquização com opção “não mostrar novamente”. Evidência: `HIERARQUIZACAO_INTRO_STORAGE_KEY` em `triagem/page.tsx`.
53. `✅` Ícone/avatar do solicitante na fila e detalhe. Evidência: `resolveRequesterName`/avatar em `triagem/page.tsx`.
54. `🟡` Usuário relatou bug visual de sheet/scroll; apesar de refatorações, falta teste formal em dispositivos pequenos e com volume alto.

## 8) Consolidação e exportações
55. `✅` Consolidação com filtros de grupo, classe, tipo, servidor, departamento/laboratório. Evidência: `src/app/(admin)/admin/consolidacao/page.tsx`.
56. `✅` Exportação CSV e XLSX no webapp. Evidência: `consolidacao/page.tsx` e `exportacao/page.tsx`.
57. `✅` Seção pandas removida da UI principal de consolidação. Evidência: ausência de execução pandas na tela; doc `docs/analise-pandas.md` legado.
58. `🟡` Pedido de menus hambúrguer nas duas laterais da consolidação não está formalizado como componente dedicado.
59. `🟡` Ajustes finos de densidade visual para cenário 900+ itens ainda precisam benchmark UX/performance.

## 9) Dashboard e experiência por papel
60. `✅` Dashboard com variação por papel (solicitante/admin/superadmin). Evidência: `src/components/dashboard/UnifiedDashboard.tsx`.
61. `✅` Home tour opcional para usuário comum. Evidência: `UnifiedDashboard.tsx`.
62. `✅` Métricas e visualização de fluxo financeiro/etapas. Evidência: `UnifiedDashboard.tsx`.
63. `🟡` “Dashboard Admin com gráficos e animações avançadas” está parcialmente atendido; sem biblioteca de gráficos dedicada (Recharts) nesta versão.

## 10) Ajustes (admin), campanhas e kits
64. `✅` Dentro de Ajustes: atalhos para Usuários, Exportar, Kits, Campanhas. Evidência: `src/app/(admin)/admin/configuracoes/page.tsx`.
65. `✅` Campanhas sem datas fixas hardcoded; superadmin define janelas no sistema. Evidência: `campanhas/page.tsx`.
66. `✅` Encerramento ajustado para `23:59` via normalização de janela. Evidência: `toCycleBoundaryISO` em `campanhas/page.tsx`.
67. `✅` Status automático de ciclo por janela/fase. Evidência: `deriveAutoStatus` em `campanhas/page.tsx`.
68. `✅` Alertas 15/7/1 dias por notificações + fila de e-mail. Evidência: `enqueueCycleMilestoneAlerts` em `campanhas/page.tsx`.
69. `🟡` Deduplicação de alertas depende da consistência da tabela `notifications` no banco real e de execução programada controlada.
70. `🟡` Kits institucionais “início de semestre/prática/papelaria” não estão pré-populados automaticamente; fluxo existe, conteúdo oficial falta curadoria.

## 11) PDF, identidade visual e marcas
71. `✅` PDF/Impressão em layout dedicado (não print da interface inteira). Evidência: `dfd/[id]/impressao/page.tsx`, `minhas-dfds/[id]/pdf/page.tsx`.
72. `✅` PDF com status atual da DFD. Evidência: `dfd/[id]/impressao/page.tsx`.
73. `✅` Assinatura SHA-256 + QR code de verificação. Evidência: `src/lib/dfd-signature.ts`, APIs `/api/dfd/signature` e `/api/dfd/verify`.
74. `✅` Logos por campus no PDF e shell. Evidência: `src/lib/campus-branding.ts` + páginas de impressão + `AppShell`.
75. `✅` Foto de solicitante/aprovador no documento de impressão principal. Evidência: `dfd/[id]/impressao/page.tsx`.
76. `🟡` Cobertura de avatar/aprovador para casos legados depende da qualidade de dados em `dfd_logs` e `profiles`.
77. `🟡` Remoção total de roxo do sistema ainda não concluída (há resíduos em alguns módulos).

## 12) Loading e microinterações
78. `✅` Loading global com sandália PNG (sem SVG) e animação de caminhada. Evidência: `src/components/layout/GlobalLoadingScreen.tsx`, `public/sandalia.png`.
79. `✅` Mensagens em loop aleatório com grande lista institucional. Evidência: `LOADING_MESSAGES` em `GlobalLoadingScreen.tsx`.
80. `✅` Texto maior e progress bar discreta com shimmer. Evidência: `GlobalLoadingScreen.tsx`.
81. `✅` Fundo em tom quente “sertão” aplicado no loading. Evidência: gradiente em `GlobalLoadingScreen.tsx`.

## 13) Dados legados, RLS e banco
82. `✅` Migration para legado com status “Em pactuação”. Evidência: `20260421160008_legacy_pa_status_em_pactuacao.sql`.
83. `✅` Migrações de relação legado por e-mail e visibilidade fiscal. Evidência: `20260421160006/7/8`, `20260421170009`.
84. `✅` Safe rollout de mapeamento legado→perfil com validações. Evidência: `20260424013000_legacy_profile_mapping_safe_rollout.sql`.
85. `✅` Painel de pendências de vínculo legado em Usuários. Evidência: `src/app/(admin)/admin/usuarios/page.tsx`.
86. `⛔` Aplicar migrations no projeto Supabase de produção ainda depende de execução no SQL Editor.
87. `⛔` Troca completa de mocks por dados reais depende de carga/seed no banco real.
88. `⛔` Migration “0012” (vínculo laboratório por campus) depende execução no banco remoto.

## 14) Notificações e e-mails
89. `✅` Bell de notificações com leitura individual/geral. Evidência: `src/components/layout/NotificationBell.tsx`.
90. `✅` Dispatcher de e-mails em lote (API). Evidência: `src/app/api/notifications/dispatch/route.ts`.
91. `✅` Serviço de envio por Resend ou SMTP. Evidência: `src/lib/email.ts`.
92. `🟡` Templates finais institucionais de e-mail ainda precisam fechamento editorial.
93. `🔴` Painel administrativo de falhas/reenvio ainda não existe como módulo dedicado.

## 15) Deploy e operação
94. `✅` Projeto compila e passa lint/build localmente (`npm run deploy:check`).
95. `🟡` Deploy automático + domínio Vercel `percata...` depende configuração de conta/projeto/domínio (fora do código).
96. `🟡` Smoke test por perfil com dados reais ainda não documentado como execução final validada.
97. `🟡` Testes formais de acessibilidade/performance com evidência (relatório) ainda pendentes.

---

## Top Prioridades (ordem sugerida para fechar 100%)
1. `P0` Aplicar migrations pendentes no Supabase de produção (`0012`, auditoria, settings, legacy mapping) e validar RLS por perfil/campus.
2. `P0` Corrigir divergência callback x middleware para whitelist de e-mails legados (`legacy_user_profile_links` no middleware).
3. `P0` Executar smoke test completo com 4 papéis (solicitante, chefia, admin, superadmin) em dados reais.
4. `P1` Remover resíduos roxos e consolidar paleta UPE (azul/vermelho + neutros) em todos os módulos.
5. `P1` Fechar pendências UX de Triagem/Consolidação para volume alto (900+ itens) com benchmark documentado.
6. `P1` Concluir templates finais de e-mail + painel simples de reenvio/falha.

---

## Decisões de produto ainda em aberto
1. Orçamento Setorial permanece como módulo próprio ou vira painel dentro da Triagem?
2. Exportação continua separada da Consolidação ou unifica em uma única tela?
3. Nível de profundidade de gráficos (M3 + charts) por papel: mínimo viável vs executivo completo.

