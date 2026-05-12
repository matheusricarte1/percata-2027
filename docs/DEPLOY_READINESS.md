# Deploy Readiness — PERCATA 2027

## 1) Pré-requisitos
- Node.js 20+
- Projeto Supabase com migrations aplicadas
- Variáveis de ambiente definidas (veja `.env.example`)

## 2) Segurança mínima antes do deploy
- Nunca publicar `SUPABASE_SERVICE_ROLE_KEY` no cliente.
- Confirmar que apenas `admin/superadmin` conseguem chamar `POST /api/notifications/dispatch`.
- Revisar políticas RLS das tabelas novas (`email_alert_queue`, `governanca_ciclos`, `notifications`).

## 3) Verificação técnica
Execute:

```bash
npm run deploy:check
```

Status esperado:
- ESLint sem erros
- Build de produção concluída

## 4) Checklist funcional rápido
- Login Google e onboarding
- Catálogo + carrinho + geração de DFD por classe
- Triagem (priorização + pareto)
- Consolidação (filtros + export CSV/XLSX)
- Usuários (configuração + ações)
- Campanhas (status automático + alertas 15/7/1)
- PDF/Impressão DFD

## 5) Publicação
### Vercel
- Definir env vars no projeto
- Deploy do branch principal
- Validar rotas protegidas em produção

### Servidor próprio
- `npm run build`
- `npm run start`
- Reverse proxy (Nginx/Caddy)
- HTTPS obrigatório

## 6) Pós-deploy
- Verificar fila `email_alert_queue` por 24h
- Monitorar erros de API e console
- Validar permissões por perfil (solicitante/chefia/admin/superadmin)
