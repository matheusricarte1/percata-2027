export type CollectiveUnitType = "departamento" | "laboratorio";
export type CollectiveRoomStatus =
  | "proposta"
  | "aberta"
  | "em_consolidacao_chefia"
  | "pronta_para_conversao"
  | "convertida"
  | "arquivada";
export type CollectiveRoomRole = "membro" | "chefia" | "admin" | "superadmin";
export type CollectiveExpenseClass = "custeio" | "investimento" | "outro" | "sem-gnd";

export type CollectiveContribution = {
  unit_id?: string | null;
  unit_type?: CollectiveUnitType | string | null;
  user_id?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  user_avatar_url?: string | null;
  codigo_item_efisco?: string | null;
  codigo_tce?: string | null;
  descricao?: string | null;
  unidade_medida?: string | null;
  quantidade?: number | null;
  valor_unitario_estimado?: number | null;
  justificativa_item?: string | null;
  link_referencia?: string | null;
  gnd?: string | null;
  gnd_derivado?: string | null;
  codigo_natureza_despesa?: string | null;
  tipo_objeto?: string | null;
  codigo_grupo?: string | null;
  nome_grupo?: string | null;
  codigo_classe?: string | null;
  nome_classe?: string | null;
};

export type CollectiveContributor = {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_avatar_url?: string | null;
  quantidade: number;
};

export type ParsedCollectiveContributor = {
  name: string;
  quantidade: number;
};

export type CollectiveAggregatedItem = CollectiveContribution & {
  quantidade: number;
  valor_unitario_estimado: number;
  contributors: CollectiveContributor[];
};

export type CollectiveRoomParticipant = {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_avatar_url: string | null;
  quantidade: number;
  total: number;
};

export type CollectiveRoomSummary = {
  participants: CollectiveRoomParticipant[];
  participantCount: number;
  itemCount: number;
  totalQuantity: number;
  totalValue: number;
  userHasContributed: boolean;
};

export type CollectiveExpenseClassGroup = {
  expenseClass: CollectiveExpenseClass;
  label: string;
  items: CollectiveAggregatedItem[];
  totalValue: number;
};

function normalizeKeyPart(value?: string | null) {
  return String(value || "")
    .trim()
    .toLocaleUpperCase("pt-BR");
}

function getCollectiveExpenseClassKey(item: CollectiveContribution) {
  const digits = String(item.gnd || item.gnd_derivado || item.codigo_natureza_despesa || "")
    .replace(/\D/g, "");
  if (digits[0] === "3") return "custeio";
  if (digits[0] === "4") return "investimento";
  if (digits.length > 0) return "outro";
  return "sem-gnd";
}

function getCollectiveExpenseLabel(expenseClass: CollectiveExpenseClass) {
  if (expenseClass === "custeio") return "Custeio";
  if (expenseClass === "investimento") return "Investimento";
  if (expenseClass === "sem-gnd") return "Sem GND";
  return "Outras naturezas";
}

export function buildCollectiveContributionKey(item: CollectiveContribution) {
  const itemCode =
    normalizeKeyPart(item.codigo_item_efisco) ||
    normalizeKeyPart(item.codigo_tce) ||
    normalizeKeyPart(item.descricao);
  const expenseClass = getCollectiveExpenseClassKey(item);
  const gnd = normalizeKeyPart(item.gnd || item.gnd_derivado || item.codigo_natureza_despesa);

  return [itemCode, expenseClass, gnd].join("::");
}

export function validateCollectiveUnitScope(items: CollectiveContribution[]) {
  const scopes = new Set(
    items
      .map((item) => `${item.unit_type || ""}:${item.unit_id || ""}`)
      .filter((value) => value !== ":"),
  );

  if (scopes.size > 1) {
    throw new Error(
      "A DFD coletiva só pode reunir pessoas do mesmo setor/laboratorio.",
    );
  }

  return true;
}

export function aggregateCollectiveContributions(
  contributions: CollectiveContribution[],
) {
  validateCollectiveUnitScope(contributions);

  const grouped = new Map<string, CollectiveAggregatedItem>();

  for (const contribution of contributions) {
    const key = buildCollectiveContributionKey(contribution);
    const quantity = Math.max(0, Number(contribution.quantidade || 0));
    if (quantity <= 0) continue;

    const current =
      grouped.get(key) ||
      ({
        ...contribution,
        quantidade: 0,
        valor_unitario_estimado: 0,
        contributors: [],
      } satisfies CollectiveAggregatedItem);

    current.quantidade += quantity;
    current.valor_unitario_estimado = Math.max(
      Number(current.valor_unitario_estimado || 0),
      Number(contribution.valor_unitario_estimado || 0),
    );

    const userId = String(contribution.user_id || "").trim();
    if (userId) {
      const existing = current.contributors.find((entry) => entry.user_id === userId);
      if (existing) {
        existing.quantidade += quantity;
      } else {
        current.contributors.push({
          user_id: userId,
          user_name: contribution.user_name || null,
          user_email: contribution.user_email || null,
          user_avatar_url: contribution.user_avatar_url || null,
          quantidade: quantity,
        });
      }
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.values()).sort((a, b) =>
    String(a.descricao || "").localeCompare(String(b.descricao || ""), "pt-BR"),
  );
}

export function canEditCollectiveRoom(
  status: CollectiveRoomStatus,
  actorRole: CollectiveRoomRole,
  options?: { isProposalOwner?: boolean },
) {
  if (status === "convertida") return false;
  if (actorRole === "admin" || actorRole === "superadmin") return true;
  if (actorRole === "chefia") return true;
  return status === "proposta" && Boolean(options?.isProposalOwner);
}

export function canPublishCollectiveRoom(
  status: CollectiveRoomStatus,
  actorRole: CollectiveRoomRole,
) {
  if (actorRole !== "chefia" && actorRole !== "admin" && actorRole !== "superadmin") {
    return false;
  }
  return status === "proposta";
}

export function canReopenCollectiveRoom(
  status: CollectiveRoomStatus,
  actorRole: CollectiveRoomRole,
) {
  if (actorRole !== "chefia" && actorRole !== "admin" && actorRole !== "superadmin") {
    return false;
  }
  return status === "em_consolidacao_chefia" || status === "pronta_para_conversao";
}

export function canContributeCollectiveRoom(
  status: CollectiveRoomStatus,
  actorRole: CollectiveRoomRole,
) {
  if (actorRole === "admin" || actorRole === "superadmin") return status === "aberta";
  return status === "aberta";
}

export function canConvertCollectiveRoom(
  status: CollectiveRoomStatus,
  actorRole: CollectiveRoomRole,
) {
  if (actorRole !== "chefia" && actorRole !== "admin" && actorRole !== "superadmin") {
    return false;
  }
  return status === "pronta_para_conversao";
}

export function canEditCollectiveContribution({
  roomStatus,
  actorRole,
  actorId,
  ownerId,
}: {
  roomStatus: CollectiveRoomStatus;
  actorRole: CollectiveRoomRole;
  actorId?: string | null;
  ownerId?: string | null;
}) {
  if (
    roomStatus === "proposta" ||
    roomStatus === "convertida" ||
    roomStatus === "arquivada"
  ) {
    return false;
  }
  if (actorRole === "admin" || actorRole === "superadmin" || actorRole === "chefia") {
    return true;
  }
  return (
    roomStatus === "aberta" &&
    Boolean(actorId) &&
    Boolean(ownerId) &&
    String(actorId) === String(ownerId)
  );
}

export function summarizeCollectiveRoom(
  contributions: CollectiveContribution[],
  currentUserId?: string | null,
): CollectiveRoomSummary {
  const participants = new Map<string, CollectiveRoomParticipant>();
  const activeContributions = contributions.filter(
    (contribution) => Math.max(0, Number(contribution.quantidade || 0)) > 0,
  );
  const aggregatedItems = aggregateCollectiveContributions(activeContributions);

  for (const contribution of activeContributions) {
    const userId = String(contribution.user_id || "").trim();
    if (!userId) continue;

    const quantity = Math.max(0, Number(contribution.quantidade || 0));
    const total = quantity * Math.max(0, Number(contribution.valor_unitario_estimado || 0));
    const existing =
      participants.get(userId) ||
      ({
        user_id: userId,
        user_name: contribution.user_name || null,
        user_email: contribution.user_email || null,
        user_avatar_url: contribution.user_avatar_url || null,
        quantidade: 0,
        total: 0,
      } satisfies CollectiveRoomParticipant);

    existing.quantidade += quantity;
    existing.total += total;
    existing.user_name ||= contribution.user_name || null;
    existing.user_email ||= contribution.user_email || null;
    existing.user_avatar_url ||= contribution.user_avatar_url || null;
    participants.set(userId, existing);
  }

  const participantList = Array.from(participants.values()).sort((a, b) => {
    if (currentUserId && a.user_id === currentUserId && b.user_id !== currentUserId) return -1;
    if (currentUserId && b.user_id === currentUserId && a.user_id !== currentUserId) return 1;
    return String(a.user_name || a.user_email || a.user_id).localeCompare(
      String(b.user_name || b.user_email || b.user_id),
      "pt-BR",
    );
  });

  return {
    participants: participantList,
    participantCount: participantList.length,
    itemCount: aggregatedItems.length,
    totalQuantity: aggregatedItems.reduce((acc, item) => acc + Number(item.quantidade || 0), 0),
    totalValue: aggregatedItems.reduce(
      (acc, item) =>
        acc +
        Number(item.quantidade || 0) *
          Number(item.valor_unitario_estimado || 0),
      0,
    ),
    userHasContributed: currentUserId
      ? activeContributions.some(
          (contribution) => String(contribution.user_id || "") === String(currentUserId),
        )
      : false,
  };
}

export function splitCollectiveItemsByExpenseClass(
  items: CollectiveAggregatedItem[],
): CollectiveExpenseClassGroup[] {
  const grouped = new Map<CollectiveExpenseClass, CollectiveAggregatedItem[]>();
  for (const item of items) {
    const key = getCollectiveExpenseClassKey(item) as CollectiveExpenseClass;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(item);
  }

  const order: CollectiveExpenseClass[] = ["custeio", "investimento", "outro", "sem-gnd"];
  return order
    .filter((key) => grouped.has(key))
    .map((expenseClass) => {
      const classItems = grouped.get(expenseClass) || [];
      return {
        expenseClass,
        label: getCollectiveExpenseLabel(expenseClass),
        items: classItems,
        totalValue: classItems.reduce(
          (acc, item) =>
            acc +
            Number(item.quantidade || 0) *
              Number(item.valor_unitario_estimado || 0),
          0,
        ),
      };
    });
}

export function formatContributorDistribution(contributors: CollectiveContributor[]) {
  return contributors
    .map((entry) => `${entry.user_name || entry.user_email || entry.user_id}: ${entry.quantidade}`)
    .join("; ");
}

export function parseCollectiveDistributionText(
  justificativa?: string | null,
): ParsedCollectiveContributor[] {
  const text = String(justificativa || "");
  const match = text.match(/distribui[çc][ãa]o por usu[áa]rio:\s*([\s\S]*)$/i);
  const distribution = String(match?.[1] || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!distribution) return [];

  return distribution
    .split(";")
    .map((entry) => {
      const [rawName, ...rawQuantityParts] = entry.split(":");
      const name = String(rawName || "").trim();
      const quantidade = Number(
        String(rawQuantityParts.join(":") || "0")
          .replace(/[^\d,.]/g, "")
          .replace(",", "."),
      );

      if (!name) return null;

      return {
        name,
        quantidade: Number.isFinite(quantidade) ? quantidade : 0,
      };
    })
    .filter((entry): entry is ParsedCollectiveContributor => Boolean(entry));
}

export function stripCollectiveContributionProfileFields<
  T extends { user_name?: unknown; user_email?: unknown },
>(contribution: T) {
  const dbRow = { ...contribution };
  delete dbRow.user_name;
  delete dbRow.user_email;
  return dbRow;
}
