import { buildCsv } from "./admin-reports";
import {
  DFD_PLANNING_FIELD_LABELS,
  DFD_PLANNING_FIELD_ORDER,
  sanitizePlanningSubsidies,
  type DfdPlanningSubsidies,
} from "./dfd-planning";

export type DfdPrintExportItem = {
  cod: string;
  desc: string;
  qtd: number;
  un: string;
  valor: number;
  gnd?: string | null;
  natureza?: string | null;
  local_uso?: string | null;
  justificativa_item?: string | null;
  link_referencia?: string | null;
  distribuicao_usuarios?: string | null;
  distribuicao_usuarios_json?: string | null;
};

export type DfdPrintExportAuthor = {
  nome: string;
  email?: string | null;
  quantidade_total?: number | null;
  valor_total_estimado?: number | null;
};

export type DfdPrintExportData = {
  protocolo: string;
  data: string;
  status: string;
  solicitante: string;
  email: string;
  setor: string;
  campus: string;
  objeto: string;
  justificativa: string;
  planning_subsidies?: DfdPlanningSubsidies | null;
  gnd: string;
  origem?: string;
  sala_coletiva?: string;
  coautores?: string;
  coautores_detalhados?: DfdPrintExportAuthor[];
  itens: DfdPrintExportItem[];
};

const HEADERS = [
  "secao",
  "campo",
  "valor",
  "codigo",
  "descricao",
  "quantidade",
  "unidade",
  "valor_unitario",
  "valor_total",
  "gnd",
  "natureza",
  "local_uso",
  "justificativa_item",
  "link_referencia",
  "distribuicao_usuarios",
  "distribuicao_usuarios_json",
];

function metadataRow(campo: string, valor: string | number | null | undefined) {
  return {
    secao: "DFD",
    campo,
    valor: valor ?? "",
    codigo: "",
    descricao: "",
    quantidade: "",
    unidade: "",
    valor_unitario: "",
    valor_total: "",
  };
}

export function buildDfdPrintExportCsv(data: DfdPrintExportData) {
  const planningSubsidies = sanitizePlanningSubsidies(data.planning_subsidies);
  const rows = [
    metadataRow("protocolo", data.protocolo),
    metadataRow("data", data.data),
    metadataRow("status", data.status),
    metadataRow("solicitante", data.solicitante),
    metadataRow("email", data.email),
    metadataRow("setor", data.setor),
    metadataRow("campus", data.campus),
    metadataRow("objeto", data.objeto),
    metadataRow("justificativa", data.justificativa),
    ...DFD_PLANNING_FIELD_ORDER.flatMap((field) =>
      planningSubsidies[field]
        ? [
            metadataRow(
              `Informações de planejamento - ${DFD_PLANNING_FIELD_LABELS[field]}`,
              planningSubsidies[field],
            ),
          ]
        : [],
    ),
    metadataRow("gnd", data.gnd),
    ...(data.origem ? [metadataRow("origem", data.origem)] : []),
    ...(data.sala_coletiva ? [metadataRow("sala_coletiva", data.sala_coletiva)] : []),
    ...(data.coautores ? [metadataRow("coautores", data.coautores)] : []),
    ...(data.coautores_detalhados || []).map((author, index) => ({
      secao: "COAUTOR",
      campo: `coautor_${index + 1}`,
      valor: author.nome,
      codigo: "",
      descricao: author.email || "",
      quantidade: Number(author.quantidade_total || 0),
      unidade: "",
      valor_unitario: "",
      valor_total: Number(author.valor_total_estimado || 0).toFixed(2),
      gnd: "",
      natureza: "",
      local_uso: "",
      justificativa_item: "",
      link_referencia: "",
      distribuicao_usuarios: "",
      distribuicao_usuarios_json: "",
    })),
    ...data.itens.map((item, index) => ({
      secao: "ITEM",
      campo: `item_${index + 1}`,
      valor: "",
      codigo: item.cod,
      descricao: item.desc,
      quantidade: Number(item.qtd || 0),
      unidade: item.un,
      valor_unitario: Number(item.valor || 0).toFixed(2),
      valor_total: (Number(item.qtd || 0) * Number(item.valor || 0)).toFixed(2),
      gnd: item.gnd || "",
      natureza: item.natureza || "",
      local_uso: item.local_uso || "",
      justificativa_item: item.justificativa_item || "",
      link_referencia: item.link_referencia || "",
      distribuicao_usuarios: item.distribuicao_usuarios || "",
      distribuicao_usuarios_json: item.distribuicao_usuarios_json || "",
    })),
  ];

  return buildCsv(rows, HEADERS);
}
