# Auditoria Integral Local - Rodada 2

Data: 2026-04-29
Ambiente: local
Escopo: PERCATA web, Supabase, rotas autenticadas, RLS, APIs administrativas e fluxos por perfil.

## Objetivo da rodada

Esta rodada partiu da auditoria integral inicial e executou uma verificacao autenticada com usuarios reais de auditoria para validar se as correcoes anteriores permanecem funcionais quando o sistema e usado por cada perfil.

Perfis exercitados:

- solicitante
- chefia
- admin

## Correcoes aplicadas nesta rodada

### 1. Login local controlado para auditoria

Foi criado um endpoint local de apoio para permitir testes autenticados repetiveis por perfil:

- `src/app/api/dev/audit-login/route.ts`

Caracteristicas de seguranca:

- indisponivel em `NODE_ENV=production`;
- limitado a `localhost`, `127.0.0.1` e `::1`;
- exige `PERCATA_AUDIT_PASSWORD` definido no processo local;
- aceita apenas os perfis `solicitante`, `chefia` e `admin`;
- nao expoe credenciais no codigo.

Tambem foi liberada a rota no proxy local:

- `src/proxy.ts`

### 2. Smoke test autenticado por perfil

Foi executado um roteiro Playwright autenticando cada perfil e acessando rotas representativas.

Resultado por perfil:

| Perfil | Rotas esperadas | Rotas proibidas | Resultado |
|---|---|---|---|
| solicitante | `/dashboard`, `/catalogo`, `/nova-dfd`, `/minhas-dfds`, `/configuracoes` | `/admin`, `/triagem` | aprovado |
| chefia | `/dashboard`, `/triagem`, `/triagem/orcamento`, `/triagem/configuracoes` | `/admin`, `/catalogo` | aprovado |
| admin | `/dashboard`, `/admin`, `/admin/configuracoes`, `/admin/usuarios` | `/catalogo`, `/triagem` | aprovado |

Observacoes:

- As rotas proibidas redirecionaram para a area correta do perfil.
- Nao foram capturados erros de console nas paginas exercitadas.
- O carregamento inicial deixou de ser tratado por `networkidle` e passou a validar a conclusao real da tela, evitando falso positivo em telas com conexoes longas ou dados assincronos.

## Validacao de APIs sensiveis

Foram testadas chamadas autenticadas de permissao negativa.

| Perfil | `/api/notifications/status` | `/api/notifications/dispatch?batch=1` | `/api/superadmin/org-structure` |
|---|---:|---:|---:|
| solicitante | 200 | 403 | 403 |
| chefia | 200 | 403 | 403 |
| admin | 200 | 200 | 403 |

Conclusao:

- O disparo de notificacoes ficou restrito a perfil administrativo.
- A rota de superadmin permaneceu bloqueada para perfis sem permissao.
- A consulta de status retorna resposta segura para perfis comuns, sem expor fila administrativa.

## Validacao RLS negativa

Foram consultadas tabelas sensiveis diretamente como cada perfil autenticado.

| Tabela | solicitante | chefia | admin | Resultado |
|---|---:|---:|---:|---|
| `admin_user_audit_logs` | 0 | 0 | 0 | protegido |
| `auth_login_events` | 0 | 0 | 0 | protegido |
| `email_alert_queue` | 0 | 0 | 3 | protegido por papel |
| `dfds` | 1 | 0 | 3 | compativel com perfil testado |
| `notifications` | 0 | 0 | 3 | compativel com perfil testado |
| `profiles` | 3 | 3 | 3 | risco residual |

## Risco residual: `profiles`

A politica atual de leitura em `profiles` permite leitura ampla para usuarios autenticados:

```sql
auth.role() = 'authenticated'
```

Impacto:

- Um solicitante autenticado consegue listar perfis de outros usuarios.
- A exposicao pode incluir e-mail, nome, papel e campos auxiliares, dependendo da consulta.

Por que nao foi alterado diretamente nesta rodada:

- O frontend ainda consulta `profiles` em multiplos fluxos: layouts, triagem, DFD, PDF, onboarding, dashboard e telas administrativas.
- Uma restricao imediata para "apenas o proprio perfil" quebraria telas que exibem solicitante, aprovador, triagem ou listas administrativas.
- A correcao segura exige substituir leituras diretas por endpoints autorizados ou views sanitizadas com politicas especificas.

Correcao recomendada para a proxima rodada:

1. Criar endpoint seguro para resolucao de perfis relacionados a DFDs e triagem.
2. Trocar telas comuns para consumir apenas dados minimos: `id`, `full_name`, `email` quando autorizado, `avatar_url` se necessario.
3. Manter leitura ampla somente para admin/superadmin.
4. Alterar RLS de `profiles` para leitura do proprio usuario ou leitura administrativa.
5. Reexecutar smoke test de solicitante, chefia e admin.

## Validacao tecnica

Comandos executados ao final da rodada:

```powershell
npm run lint
npm run build
```

Resultado:

- lint aprovado;
- build aprovado;
- o build reconheceu o arquivo `src/proxy.ts` como `Proxy (Middleware)`;
- a rota local de auditoria foi incluida no build, mas retorna 404 em producao por protecao interna.

## Estado da rodada

Corrigido:

- suporte local controlado para auditoria autenticada;
- validacao real de permissoes por perfil;
- validacao negativa de APIs sensiveis;
- confirmacao de lint e build apos as alteracoes.

Pendente priorizado:

- reduzir a superficie de leitura de `profiles`;
- auditar botoes destrutivos e mutacoes de telas administrativas com teste de clique controlado;
- criar testes automatizados permanentes para login por perfil, bloqueios de rota e permissoes negativas de API.

