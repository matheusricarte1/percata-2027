# Auditoria Integral Local - Rodada 3

Data: 2026-04-29
Ambiente: local + Supabase remoto
Escopo: correcao do risco residual de `profiles`, RLS e protecao contra autopromocao.

## Correcoes aplicadas

### 1. RLS de `profiles` endurecida

Foi criada e aplicada a migracao:

- `supabase/migrations/20260429103000_harden_profiles_rls.sql`
- copia operacional: `../supabase-migrations/0037_harden_profiles_rls.sql`

A politica antiga permitia leitura ampla para qualquer usuario autenticado:

```sql
auth.role() = 'authenticated'
```

A politica atual usa:

```sql
app_can_select_profile(id, campus_id, role)
```

Isso limita a leitura a:

- o proprio perfil;
- perfis acessiveis por admin/superadmin;
- solicitantes de DFDs que o usuario pode acessar;
- revisores do mesmo campus quando existe DFD propria naquele campus, preservando o fluxo de notificacao ao enviar DFD para triagem.

### 2. Funcoes auxiliares protegidas contra RLS recursiva

Foram recriadas como `SECURITY DEFINER`:

- `app_is_superadmin`
- `app_current_profile_role`
- `app_user_campus_id`
- `app_is_admin`
- `app_is_chefia_for_unit`
- `app_can_access_campus`
- `app_can_select_profile`

Motivo:

- evitar recursao ou falso negativo quando uma politica RLS precisa consultar o proprio perfil do usuario atual;
- manter politicas de `dfds`, `dfd_items`, `notifications` e referencias funcionando apos o fechamento de `profiles`.

### 3. Bloqueio de autopromocao e troca indevida de campus

Foi criado o trigger:

- `protect_profile_self_update`

Ele impede usuario comum de:

- alterar o proprio `role`;
- trocar `campus_id` depois que ja possui campus definido;
- alterar `signature_hash`;
- gravar e-mail diferente do e-mail autenticado.

Excecoes preservadas:

- operacoes internas sem `auth.uid()`, como o trigger que sincroniza `auth.users` para `profiles`;
- operacoes com `service_role`;
- operacoes administrativas autorizadas.

## Regressao encontrada e corrigida durante a rodada

A primeira versao do trigger bloqueou o login dos usuarios de auditoria porque o projeto ja possui um trigger em `auth.users` que sincroniza identidade no `profiles` durante login.

Erro observado:

```text
Database error granting user
```

Correcao aplicada:

- o trigger de protecao agora permite operacoes internas sem `auth.uid()`;
- o bloqueio continua ativo para usuarios autenticados comuns.

## Evidencias de seguranca

### Acesso anonimo

Consulta anonima a `profiles`:

```json
{ "anonError": null, "anonRows": 0 }
```

Resultado: anônimo nao enxerga linhas de perfil.

### Leitura autenticada apos RLS

| Perfil | `profiles` visiveis | Resultado |
|---|---:|---|
| solicitante | 4 | restrito ao proprio contexto e revisores relacionados |
| chefia | 1 | restrito ao proprio perfil neste conjunto de auditoria |
| admin | 6 | acesso administrativo preservado |

### Tentativa de autopromocao

| Perfil | Tentou alterar `role` para `admin` | Resultado |
|---|---|---|
| solicitante | sim | bloqueado |
| chefia | sim | bloqueado |
| admin | sim | permitido, pois ja e perfil administrativo |

### Tabelas sensiveis

| Tabela | solicitante | chefia | admin |
|---|---:|---:|---:|
| `admin_user_audit_logs` | 0 | 0 | 0 |
| `auth_login_events` | 0 | 0 | 0 |
| `email_alert_queue` | 0 | 0 | 26 |
| `profiles` | 4 | 1 | 6 |
| `dfds` | 1 | 0 | 28 |
| `notifications` | 0 | 0 | 25 |

## Validacao tecnica

Comandos executados:

```powershell
npm run lint
npm run build
```

Resultado:

- lint aprovado;
- build aprovado;
- 40 rotas geradas;
- `src/proxy.ts` reconhecido como `Proxy (Middleware)`.

## Estado apos a rodada

Resolvido:

- leitura global de `profiles` para qualquer autenticado;
- risco de autopromocao por update direto no Supabase;
- risco de troca livre de campus por usuario comum;
- regressao de login causada pela primeira versao do trigger.

Residual para proxima auditoria:

- reduzir ainda mais a exposicao de revisores por campus, se o fluxo de notificacao for migrado para endpoint server-side;
- trocar consultas client-side a `profiles` por endpoints mais especificos nas telas de DFD/triagem;
- automatizar esses testes RLS em script de regressao permanente.

