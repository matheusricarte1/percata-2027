import { createHash } from "crypto";

type DfdLike = {
  id: string;
  numero_protocolo?: string | null;
  solicitante_id?: string | null;
  status?: string | null;
  valor_total_estimado?: number | null;
  previsao_recebimento?: string | null;
};

type DfdItemLike = {
  id?: string | null;
  codigo_tce?: string | null;
  descricao?: string | null;
  quantidade?: number | null;
  valor_unitario_estimado?: number | null;
  gnd?: string | null;
};

function normalizeNumber(value: unknown) {
  return Number(value || 0).toFixed(4);
}

export function buildDfdSignaturePayload(dfd: DfdLike, items: DfdItemLike[]) {
  const normalizedItems = [...items]
    .map((item) => ({
      codigo_tce: String(item.codigo_tce || "").trim(),
      descricao: String(item.descricao || "").trim(),
      quantidade: normalizeNumber(item.quantidade),
      valor_unitario_estimado: normalizeNumber(item.valor_unitario_estimado),
      gnd: String(item.gnd || "").trim(),
    }))
    .sort((a, b) => {
      const left = `${a.codigo_tce}|${a.descricao}|${a.gnd}`;
      const right = `${b.codigo_tce}|${b.descricao}|${b.gnd}`;
      return left.localeCompare(right);
    });

  return JSON.stringify({
    id: String(dfd.id || "").trim(),
    numero_protocolo: String(dfd.numero_protocolo || "").trim(),
    solicitante_id: String(dfd.solicitante_id || "").trim(),
    status: String(dfd.status || "").trim(),
    valor_total_estimado: normalizeNumber(dfd.valor_total_estimado),
    previsao_recebimento: String(dfd.previsao_recebimento || "").trim(),
    items: normalizedItems,
  });
}

export function computeDfdSignature(payload: string) {
  return createHash("sha256").update(payload).digest("hex");
}

export function isValidDfdSignature(signature: string | null | undefined) {
  return /^[a-f0-9]{64}$/i.test(String(signature || "").trim());
}

export function buildDfdVerificationUrl({
  origin,
  id,
  signature,
}: {
  origin: string;
  id: string;
  signature: string;
}) {
  const cleanOrigin = String(origin || "").trim().replace(/\/+$/, "");
  const cleanId = String(id || "").trim();
  const cleanSignature = String(signature || "").trim().toLowerCase();

  if (!cleanOrigin || !cleanId || !isValidDfdSignature(cleanSignature)) {
    return "";
  }

  const baseUrl = cleanOrigin.startsWith("http") ? cleanOrigin : `https://${cleanOrigin}`;
  const url = new URL("/verificar-dfd", baseUrl);
  url.searchParams.set("id", cleanId);
  url.searchParams.set("sig", cleanSignature);
  return url.toString();
}
