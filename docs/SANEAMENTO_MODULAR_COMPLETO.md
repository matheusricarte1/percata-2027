# Saneamento Modular Completo — PERCATA 2027

## 1) Shell, Navegação e Design System
- [x] Sidebar sem barra de rolagem visível.
- [x] Dashboard unificado para `/dashboard` e `/admin` por nível de acesso.
- [ ] Padronizar 100% dos layouts para tokens globais (sem hardcode residual).
- [ ] Revisar consistência visual mobile/tablet em todos os shells.
- [ ] Documentar guideline final (tipografia, densidade, estados, animações).

## 2) Sidebar (estilo Teams)
- [x] Aplicar visual cinza integral tipo Teams (rail, hover, ativo, divisores, badge).
- [x] Uniformizar microinterações dos ícones e estados de foco/acessibilidade.
- [ ] Validar contraste WCAG AA em todos os estados.

## 3) Onboarding
- [x] Fluxo centralizado com seleção por campus e perfis.
- [ ] Revisar cópia final e mensagens de erro/ajuda.
- [ ] Validar comportamento para superadmin multi-campus em produção.
- [ ] Cobrir casos de troca de campus sem perda de seleção.

## 4) Catálogo
- [x] Carrinho lateral de ponta a ponta e feedback visual de seleção.
- [ ] Refinar animação de inclusão no carrinho em todos os estados de card.
- [ ] Revisar densidade de informação para listas grandes (>1000 itens).
- [ ] Padronizar variações visuais de card com o mesmo sistema de cores.

## 5) Nova DFD / Fluxo de criação
- [x] Validação de campos obrigatórios críticos.
- [x] Local de uso por departamento/laboratório.
- [x] Ajustar UX final de mensagens (contexto e orientação do próximo passo).
- [ ] Revisão final de validações de data/link/unidade em todos os blocos.

## 6) Minhas DFDs / Histórico
- [x] Impressão/PDF com layout de documento dedicado (sem shell).
- [x] Exibição de setor resolvido por vínculo real (unidade_id/tipo_unidade).
- [ ] Consolidar legadas dentro de Minhas DFDs (evitar redundância com Histórico).
- [ ] Revisar layout visual dos cards para volume alto.

## 7) Triagem (Chefia)
- [x] Estrutura de hierarquização global com Pareto separado de priorização.
- [ ] Ajustar responsividade e densidade da lista em telas menores.
- [x] Revisar performance em lote (muitos itens + animações simultâneas).
- [x] Fechar UX de “próximo passo” após salvar priorização/homologar.

## 8) Consolidação (Admin)
- [x] Removida a sessão visual de Pandas da interface.
- [x] Exportação CSV e XLSX nativas no webapp.
- [x] Sanitização visual base (painéis e filtros com paleta cinza/azul UPE).
- [ ] Otimizar leitura para cenários com 900+ itens (filtros avançados + presets).
- [ ] Revisar ranking/ordenação para tomada de decisão executiva.
- [ ] Criar modo “resumo executivo” imprimível da consolidação.

## 9) Usuários (Admin)
- [x] Ações conectadas (configurar, aviso de acesso, reset onboarding).
- [x] Sanitização visual base do módulo (padrão cinza Teams-like).
- [ ] Implementar convite real de novos usuários (não legado) com fluxo completo.
- [ ] Adicionar trilha de auditoria de mudanças de perfil/campus.
- [ ] Revisar permissões finas para evitar edição indevida.

## 10) Kits
- [ ] Fechar kits oficiais institucionais (início de semestre, prática, papelaria).
- [ ] Versionamento de kits por ciclo/campus.
- [ ] Histórico de uso de kit (telemetria para governança).

## 11) Campanhas
- [x] Status automático por janela/fase.
- [x] Janela com encerramento às 23h59.
- [x] Alertas 15/7/1 dias via notificações/e-mail queue.
- [x] Sanitização visual base do módulo (painéis e cards).
- [ ] Validar deduplicação dos alertas em cenários de múltiplas execuções.
- [ ] Exibir timeline visual de campanha no dashboard.

## 12) Exportação
- [x] CSV + XLSX.
- [x] Sanitização visual base do módulo.
- [ ] Remover qualquer redundância restante entre Exportação e Consolidação.
- [ ] Definir layout final oficial do arquivo estadual/federal.

## 13) DFD Impressa / PDF
- [x] Status atual no documento.
- [x] QR de validação de integridade.
- [x] Avatares de solicitante/aprovador no layout de impressão principal.
- [ ] Completar exibição consistente de aprovador/avatar para todos os casos legados.
- [ ] Assinatura digital simples: validar fluxo operacional com regra institucional final.

## 14) Notificações e E-mails
- [x] Fila e dispatcher ativos no app.
- [ ] Definir templates finais (campanha, homologação, devolução, lembretes).
- [ ] Monitor de falhas/reenvio com painel administrativo simples.

## 15) Segurança, Banco e Governança
- [x] Correção de leitura por relacionamento explícito (evita erro de schema cache FK).
- [ ] Revisão final de RLS por campus e por papel em todas as tabelas novas.
- [ ] Auditoria de migrations pendentes e documentação de rollback.
- [ ] Hardening de chaves/segredos e checklist de deploy.

## 16) QA, Performance e Observabilidade
- [ ] Smoke tests completos por papel (solicitante/chefia/admin/superadmin).
- [ ] Benchmark de performance (triagem + consolidação com base real).
- [ ] Check de acessibilidade (foco, teclado, contraste, leitor de tela).
- [ ] Plano de monitoramento pós-implantação.

---

## Ordem de execução de saneamento (módulo por módulo)
1. Shell + Sidebar Teams cinza
2. Admin (Consolidação, Exportação, Usuários, Campanhas, Kits)
3. Chefia (Triagem e orçamento)
4. Solicitante (Catálogo, Nova DFD, Minhas DFDs, Histórico)
5. PDF/Impressão e fechamento de QA

## Atualização desta execução (23/04/2026)
- Shell + Sidebar: concluído (cinza Teams-like + scroll invisível).
- Admin/Exportação: concluído (sanitização + XLSX).
- Admin/Usuários: concluído (sanitização + ações operacionais).
- Admin/Campanhas: concluído (sanitização + automações de janela/status/alerta).
- Solicitante/Catálogo e Histórico: sanitização base aplicada.
