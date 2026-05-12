# TODO de Execucao Final — PERCATA 2027

## Prioridade 0 (bloqueia operacao)
- [ ] Revisar e corrigir RLS de todas as tabelas novas por campus e por papel (solicitante, chefia, admin, superadmin).
- [ ] Rodar smoke test completo por perfil com dados reais (login, catalogo, nova DFD, triagem, consolidacao, exportacao).
- [ ] Validar fluxo de homologacao geral com regra Pareto 20% em casos limite.
- [ ] Fechar checklist de segredos/env para producao (Supabase, email, Vercel).

## Prioridade 1 (qualidade de produto)
- [ ] Padronizar 100% dos layouts para tokens globais (remover hardcode residual de cores/spacing/font).
- [ ] Fechar consistencia visual mobile/tablet em Shell, Catalogo, Nova DFD, Triagem e Consolidacao.
- [ ] Validar contraste WCAG AA em estados normal/hover/focus/disabled.
- [ ] Finalizar guideline oficial (tipografia, grid, densidade, animacoes, estados de feedback).

## Prioridade 2 (fluxos funcionais pendentes)
- [ ] Onboarding: validar superadmin multi-campus em producao (troca de campus sem perder selecao).
- [ ] Nova DFD: revisar validacoes finais de data/link/unidade em todos os blocos.
- [x] Minhas DFDs/Historico: consolidar legadas dentro de Minhas DFDs para evitar redundancia.
- [x] Triagem: ajustar responsividade e densidade para telas menores.
- [x] Consolidacao: filtros avancados (grupo, classe, material/servico, servidor, departamento/laboratorio) com presets.

## Prioridade 3 (governanca e administracao)
- [x] Usuarios: implementar convite real de novos usuarios (nao legados) ponta a ponta.
- [x] Usuarios: adicionar trilha de auditoria para mudancas de papel/campus.
- [ ] Kits: publicar kits oficiais (inicio de semestre, pratica, papelaria) com versionamento por ciclo/campus.
- [ ] Campanhas: validar deduplicacao de alertas 15/7/1 dias em multiplas execucoes.
- [ ] Campanhas: exibir timeline visual da campanha no dashboard.

## Prioridade 4 (documentos, notificacoes e observabilidade)
- [ ] PDF DFD: completar aprovador/avatar em casos legados e padronizar status exibido.
- [ ] Assinatura digital simples: validar fluxo institucional final.
- [ ] Notificacoes e e-mails: fechar templates finais (campanha, homologacao, devolucao, lembretes).
- [ ] Notificacoes e e-mails: criar painel simples de falhas/reenvio.
- [ ] Observabilidade: plano de monitoramento pos-implantacao (erros, performance, fila de emails).

## Deploy e operacao assistida
- [ ] Rodar `npm run deploy:check` antes de cada release.
- [ ] Publicar release notes por modulo alterado.
- [ ] Definir janela de go-live e plano de rollback de migrations.
- [ ] Executar acompanhamento intensivo nos primeiros 7 dias (suporte + metricas).

## Ordem sugerida de execucao
1. Seguranca/RLS + smoke tests por perfil.
2. Padronizacao visual e acessibilidade.
3. Fluxos funcionais pendentes (Onboarding, DFD, Triagem, Consolidacao).
4. Modulos administrativos (Usuarios, Kits, Campanhas).
5. PDF/assinatura/notificacoes/observabilidade.
6. Deploy final assistido.
