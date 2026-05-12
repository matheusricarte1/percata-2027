export type DfdDeleteStep =
  | {
      table: string;
      column: string;
      action: "delete";
      optional?: boolean;
    }
  | {
      table: string;
      column: string;
      action: "clear_source";
      optional?: boolean;
    };

export const SUPERADMIN_DFD_DELETE_STEPS: DfdDeleteStep[] = [
  {
    table: "dfd_collective_contributions",
    column: "consolidated_dfd_id",
    action: "clear_source",
    optional: true,
  },
  {
    table: "dfd_logs",
    column: "dfd_id",
    action: "delete",
    optional: true,
  },
  {
    table: "dfd_items",
    column: "dfd_id",
    action: "delete",
  },
  {
    table: "kits",
    column: "source_dfd_id",
    action: "clear_source",
    optional: true,
  },
  {
    table: "dfds",
    column: "id",
    action: "delete",
  },
];

export function isDfdDeleteConfirmationValid(
  typedValue: string | null | undefined,
  protocol: string | null | undefined,
) {
  return String(typedValue || "").trim() === String(protocol || "").trim();
}

export function getDfdDeleteStepLabels() {
  return SUPERADMIN_DFD_DELETE_STEPS.map((step) => `${step.action}:${step.table}.${step.column}`);
}
