import { buildCsv } from "./admin-reports";

export type DfdPrintExportItem = {
  cod: string;
  desc: string;
  qtd: number;
  un: string;
  valor: number;
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
  gnd: string;
  origem?: string;
  sala_coletiva?: string;
  coautores?: string;
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
    metadataRow("gnd", data.gnd),
    ...(data.origem ? [metadataRow("origem", data.origem)] : []),
    ...(data.sala_coletiva ? [metadataRow("sala_coletiva", data.sala_coletiva)] : []),
    ...(data.coautores ? [metadataRow("coautores", data.coautores)] : []),
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
    })),
  ];

  return buildCsv(rows, HEADERS);
}
