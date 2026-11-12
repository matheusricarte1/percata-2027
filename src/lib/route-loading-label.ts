const ROUTES: [string, string][] = [
  ["/admin/configuracoes", "Configurações"],
  ["/admin/todas-dfds", "Todas as DFDs"],
  ["/admin/catalogo-busca", "Busca do Catálogo"],
  ["/admin/consolidacao", "Consolidação de Pedidos"],
  ["/admin/analytics-superadmin", "Central Analítica"],
  ["/admin/usuarios", "Usuários"],
  ["/triagem/orcamento", "Resumo do Setor"],
  ["/triagem", "Análise da Chefia"],
  ["/catalogo", "Catálogo"],
  ["/nova-dfd", "Nova Solicitação"],
  ["/minhas-dfds", "Minhas Solicitações"],
  ["/dfds-coletivas", "DFDs Coletivas"],
  ["/dfd", "Solicitação"],
  ["/historico", "Solicitações Anteriores"],
  ["/dashboard", "Painel Unificado"],
];

export function getRouteLoadingLabel(pathname: string): string {
  const path = pathname.split("?")[0];
  const route = ROUTES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return route ? `Carregando ${route[1]}...` : "Carregando o PERCATA...";
}
