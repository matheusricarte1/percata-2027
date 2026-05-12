# Auditoria Integral Local - PERCATA

Data: 2026-04-29  
Ambiente: local em `http://localhost:3000`, conectado ao Supabase configurado em `.env.local`  
Escopo: funcionamento geral, seguranca, RLS, APIs, rotas, build, smoke tests e massa controlada

## 1. Resumo executivo

A auditoria local encontrou e corrigiu tres pontos criticos:

1. A fronteira de autenticacao estava em `middleware.ts`, mas o projeto usa Next.js 16. A convencao ativa e `proxy.ts`. Rotas protegidas renderizavam sem sessao ate a migracao para `src/proxy.ts`.
2. Rotas de notificacao usavam recursos sensiveis de e-mail/service role com autorizacao ampla demais. O dispatcher agora exige `admin` ou `superadmin`, o status de fila so aparece para administracao e o teste de e-mail para terceiros tambem e restrito.
3. Tabelas publicas de referencia estavam com RLS desabilitado. A migration `20260429100000_enable_rls_reference_tables.sql` ativou RLS e politicas conservadoras para catalogo, estrutura e ciclo.

Status tecnico apos correcoes:

- `npm run lint`: passou.
- `npm run build`: passou.
- `security_rls_pending_tables`: 0 linhas.
- Smoke anonimo: rotas protegidas redirecionam para `/login?next=...`.
- Busca e-Fisco autenticada: validada via RPC.
- DFD controlada criada com usuario de auditoria e lida pelo solicitante/admin conforme RLS.

## 2. Inventario auditado

Rotas/telas mapeadas:

- Publicas/autenticacao: `/`, `/login`, `/auth/callback`, `/auth/auth-code-error`, `/onboarding`.
- Solicitante: `/dashboard`, `/catalogo`, `/nova-dfd`, `/minhas-dfds`, `/minhas-dfds/[id]/pdf`, `/dfd/[id]`, `/dfd/[id]/impressao`, `/historico`, `/historico/[code]`, `/configuracoes`.
- Chefia: `/triagem`, `/triagem/orcamento`, `/triagem/configuracoes`, `/chefia/aprovacoes`, `/chefia/orcamento`.
- Admin/superadmin: `/admin`, `/admin/configuracoes`, `/admin/usuarios`, `/admin/consolidacao`, `/admin/consolidacoes`, `/admin/exportacao`, `/admin/kits`, `/admin/campanhas`.

APIs mapeadas:

- `/api/admin/users/audit`
- `/api/admin/users/auth-users`
- `/api/admin/users/invite`
- `/api/admin/users/login-events`
- `/api/admin/users/manage`
- `/api/admin/users/sync-auth-profiles`
- `/api/dfd/signature`
- `/api/dfd/verify`
- `/api/notifications/dispatch`
- `/api/notifications/status`
- `/api/notifications/test`
- `/api/superadmin/org-structure`

Controles interativos identificados por analise estatica:

- Telas com maior concentracao de botoes/acoes: `consolidacao`, `triagem`, `usuarios`, `catalogo`, `configuracoes`, `kits`, `nova-dfd`.
- Total de arquivos com botoes/onClick relevantes: 25.
- Formulario HTML `<form>` quase nao e usado; o sistema depende majoritariamente de handlers `onClick`, inputs controlados e chamadas Supabase/fetch.

## 3. Correcoes aplicadas

### 3.1 Fronteira de autenticacao no Next.js 16

Arquivo:

- `src/proxy.ts`

Acao:

- Migrado o controle de acesso de `middleware.ts` para `src/proxy.ts`.
- Mantidas regras de:
  - redirecionamento de nao autenticado para `/login?next=...`;
  - onboarding obrigatorio quando perfil ainda nao tem campus;
  - bloqueio de `/admin` para nao admin/superadmin;
  - bloqueio de `/triagem` para solicitante/admin;
  - bloqueio de rotas de solicitante para perfis indevidos.
- Excecao publica adicionada: `/api/dfd/verify`, para permitir leitura do QR de validacao.

Evidencia:

- Antes: `/catalogo`, `/nova-dfd`, `/admin` e `/triagem` retornavam 200 e tela de loading sem sessao.
- Depois: `/catalogo` retorna 307 para `/login?next=%2Fcatalogo`.
- Playwright confirmou:
  - `/catalogo` -> `/login?next=%2Fcatalogo`
  - `/nova-dfd` -> `/login?next=%2Fnova-dfd`
  - `/admin` -> `/login?next=%2Fadmin`
  - `/triagem` -> `/login?next=%2Ftriagem`

### 3.2 Endpoints de notificacao/e-mail

Arquivos:

- `src/app/api/notifications/dispatch/route.ts`
- `src/app/api/notifications/status/route.ts`
- `src/app/api/notifications/test/route.ts`

Acao:

- `/api/notifications/dispatch`: agora exige `admin` ou `superadmin`.
- `/api/notifications/status`: usuarios comuns veem apenas status basico; fila e contadores ficam restritos a `admin`/`superadmin`.
- `/api/notifications/test`: usuario comum so pode enviar teste para o proprio e-mail; envio para terceiros exige `admin`/`superadmin`.

Risco fechado:

- Usuario autenticado comum podia acionar processamento de fila ou abusar do canal de e-mail.

### 3.3 Assinatura e QR da DFD

Arquivos:

- `src/app/api/dfd/signature/route.ts`
- `src/app/api/dfd/verify/route.ts`

Acao:

- `/api/dfd/signature` agora exige usuario autenticado e permissao sobre a DFD:
  - solicitante dono;
  - admin;
  - superadmin;
  - chefia do mesmo campus.
- `/api/dfd/verify` continua publicavel para QR, mas nao retorna mais `expectedSignature`.

Risco fechado:

- Qualquer usuario autenticado podia pedir assinatura de uma DFD por ID via service role.
- A rota de verificacao devolvia a assinatura esperada, enfraquecendo a utilidade do QR.

### 3.4 RLS em tabelas de referencia

Migration:

- `supabase/migrations/20260429100000_enable_rls_reference_tables.sql`

Tabelas corrigidas:

- `campi`
- `catalogo`
- `catalogo_efisco`
- `catalogo_search_synonyms`
- `departamentos`
- `laboratorios`
- `periodos_ciclo`

Politicas:

- Leitura autenticada para estrutura/catalogo/sinonimos.
- Leitura publica para `periodos_ciclo`, pois a landing page consulta o ciclo antes do login.
- Escrita continua sem policy publica, dependendo de service role em rotas autorizadas.

Evidencia:

- Antes: `security_rls_pending_tables` retornava 7 tabelas.
- Depois: `security_rls_pending_tables` retornou `[]`.

## 4. Massa controlada de auditoria

Usuarios criados/reutilizados no Supabase atual:

- `auditoria.solicitante@upe.br` com papel `solicitante`.
- `auditoria.chefia@upe.br` com papel `chefia`.
- `auditoria.admin@upe.br` com papel `admin`.

Observacao:

- As credenciais nao foram documentadas no relatorio por seguranca.
- O login visual do produto permanece exclusivamente via Google, portanto esses usuarios foram usados para validar RLS e Supabase Auth via API, nao para o fluxo visual OAuth.

DFD de auditoria criada:

- Protocolo: `AUDIT-20260429012848`
- ID: `df168421-4939-47d6-a07b-3af78e5af7e8`
- Status: `rascunho`
- Resultado:
  - solicitante dono leu 1 linha;
  - admin leu 1 linha;
  - chefia leu 0 linhas para rascunho, comportamento aceitavel se chefia so deve atuar apos envio/homologacao.

## 5. Validacoes executadas

### 5.1 Build e lint

Comandos:

- `npm run lint`
- `npm run build`

Resultado:

- Ambos passaram.
- Build gerou 39 paginas e reconheceu `Proxy (Middleware)`.

### 5.2 Banco e RLS

Consultas de auditoria:

- `select * from public.security_rls_pending_tables order by table_name`
- `select table_name, rls_enabled, policy_count from public.security_rls_status ...`

Resultado:

- RLS pendente: 0.
- Tabelas de referencia agora com RLS ativo e policies.

### 5.3 Catalogo e-Fisco

Consulta validada:

- RPC `buscar_catalogo_inteligente('locacao de imovel', 'all', 3, 0)`

Resultado:

- Retornou servicos de locacao de imovel.

Teste com usuario autenticado:

- `auditoria.solicitante@upe.br` conseguiu consultar:
  - `catalogo`
  - `campi`
  - RPC `buscar_catalogo_inteligente('notebook')`

Teste anonimo:

- `anon` nao leu `catalogo` apos RLS.

### 5.4 Smoke test local anonimo

Ferramenta:

- Playwright Chromium headless.

Rotas testadas:

- `/`
- `/login`
- `/catalogo`
- `/nova-dfd`
- `/admin`
- `/triagem`

Resultado:

- `/` e `/login` renderizaram sem erro de console.
- Rotas protegidas redirecionaram para login com `next`.

## 6. Achados residuais

### Alta prioridade

1. Login visual autenticado ainda depende de contas Google reais.
   - Impacto: smoke test browser ponta a ponta por perfil nao foi automatizado nesta execucao.
   - Recomendacao: criar contas Google institucionais de homologacao ou adicionar um modo local controlado de login de auditoria, desativado fora de `NODE_ENV=development`.

2. `.env.local` contem segredos reais.
   - Impacto: risco se o workspace for compartilhado, zipado ou commitado acidentalmente.
   - Recomendacao: garantir `.gitignore`, rotacionar chaves expostas fora do ambiente local e mover credenciais de producao para Vercel/Supabase secrets.

3. Politicas RLS ainda devem ser revisadas semanticamente por regra de negocio.
   - Status tecnico: RLS esta ativo em todas as tabelas auditadas.
   - Risco residual: uma policy ativa pode estar permissiva demais ou restritiva demais para algum caso real.
   - Recomendacao: matriz formal por tabela/papel/campus com testes de negativa.

### Media prioridade

4. A DFD de auditoria em `rascunho` nao apareceu para chefia.
   - Pode estar correto se chefia so enxerga demandas enviadas.
   - Recomendacao: testar estados `enviada`, `aprovada`, `devolvida` e `homologada` com massa dedicada.

5. Muitas telas dependem de `onClick` e nao de `<form>`.
   - Impacto: pode dificultar acessibilidade por teclado/submit/Enter e testes automatizados.
   - Recomendacao: revisar telas criticas (`nova-dfd`, `triagem`, `usuarios`, `consolidacao`) com foco, teclado e labels.

6. Rotas de PDF/impressao usam dados montados no client.
   - Impacto: dependem de sessao e RLS no navegador, e podem falhar parcialmente se alguma tabela bloquear leitura.
   - Recomendacao: considerar renderizacao server-side autorizada para documentos finais.

### Baixa prioridade

7. Ha grande volume de migrations de busca do catalogo.
   - Impacto: historico longo e dificil de auditar.
   - Recomendacao: em uma proxima janela, gerar uma migration consolidada para ambientes novos.

8. Logs locais `.next-dev.out.log` e `.next-dev.err.log` foram gerados para a auditoria.
   - Recomendacao: manter fora de commit.

## 7. Checklist de proxima rodada

- Testar fluxo visual autenticado com quatro perfis reais: solicitante, chefia, admin, superadmin.
- Criar DFD pela UI: catalogo -> carrinho -> nova DFD -> minhas DFDs -> PDF.
- Testar transicao de status: rascunho -> enviada -> aprovada/devolvida -> consolidacao.
- Testar exportacao CSV/XLSX com dados reais.
- Testar usuarios: convite, mudanca de papel, reset onboarding, auditoria.
- Testar campanhas: deduplicacao de alertas 15/7/1 dias.
- Testar notificacoes: painel, sino, fila, envio real e falha/reenvio.
- Fazer varredura visual mobile/tablet/desktop das telas criticas.
- Executar teste de negativa por RLS para cada papel.
- Revisar chaves e credenciais antes de qualquer deploy.

## 8. Criterio de aceite recomendado

O sistema deve ser considerado pronto apenas quando:

- `npm run lint` e `npm run build` passarem.
- `security_rls_pending_tables` retornar 0 linhas.
- Cada perfil completar seu fluxo principal sem erro de console.
- Usuario comum nao conseguir acessar rotas/admin APIs fora do papel.
- Dados de campus/setor/laboratorio respeitarem isolamento esperado.
- PDF/QR validar sem expor assinatura esperada.
- Exportacoes abrirem corretamente em CSV/XLSX.
- Notificacoes nao permitirem envio/processamento por usuario comum.
