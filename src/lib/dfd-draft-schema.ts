export const DFD_DRAFT_SCHEMA_VERSION = 1;

export type DfdDraftPayload = Record<string, unknown>;

export type DfdDraftSnapshot = {
  payload: DfdDraftPayload;
  schema_version: number;
  current_step: string | null;
  updated_at: string;
  expires_at: string;
};
