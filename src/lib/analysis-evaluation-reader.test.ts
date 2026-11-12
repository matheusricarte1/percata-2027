import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAnalysisEvaluations } from "./analysis-evaluation-reader";
import { SavedItemEvaluations } from "../components/triagem/SavedItemEvaluations";
import { AnalysisSession } from "./analysis-session";
import type { AnalysisDfd, AnalysisEvaluation } from "./dfd-analysis";

const item = { id: "item", descricao: "Material", quantidade: 2, valor_unitario_estimado: 20, criticidade: "alta", moscow_categoria: "deve_ter", is_highlight_item: true };
const evaluation: AnalysisEvaluation = { actorId: "chief", name: "Ana Chefia", avatarUrl: "https://example.com/ana.png", updatedAt: "2026-10-06T20:00:00Z", baseRevision: "base", items: [item] };

test("a chefia não recebe os rascunhos de outras contas", async () => {
  const client = { from: () => { throw new Error("consulta indevida"); } } as unknown as SupabaseClient;
  assert.equal((await readAnalysisEvaluations(client, "chefia", ["dfd"], true)).size, 0);
});

test("superadmin lê somente os IDs autorizados e identifica a autora real", async () => {
  const calls: unknown[] = [];
  const client = { from(table: string) { return { select(columns: string) { calls.push([table, columns]); return { in(column: string, ids: string[]) {
    calls.push([column, ids]);
    if (table === "profiles") return Promise.resolve({ data: [{ id: "chief", full_name: "Ana Chefia", avatar_url: evaluation.avatarUrl }], error: null });
    return { order() { return Promise.resolve({ data: [{ dfd_id: "allowed", actor_id: "chief", updated_at: evaluation.updatedAt, base_revision: "base", payload: { items: [item] } }], error: null }); } };
  } }; } }; } } as unknown as SupabaseClient;
  const result = await readAnalysisEvaluations(client, "superadmin", ["allowed", "allowed"], true);
  assert.deepEqual(calls[1], ["dfd_id", ["allowed"]]);
  assert.deepEqual(result.get("allowed"), [evaluation]);
  assert.equal(result.has("other"), false);
});

test("avaliação consultada mostra decisões e foto de 20 pixels sem controles de alteração", () => {
  const html = renderToStaticMarkup(React.createElement(SavedItemEvaluations, { evaluations: [evaluation], itemId: "item", revision: "base" }));
  assert.match(html, /Ana Chefia/);
  assert.match(html, /width="20" height="20"/);
  assert.match(html, /Alto/);
  assert.match(html, /Essencial/);
  assert.match(html, /Aguardando envio/);
  assert.doesNotMatch(html, /<button|<input/);
});

test("consulta preserva rascunho e sessão do superadmin", () => {
  const ownItem = { ...item, criticidade: null, moscow_categoria: null };
  const dfd: AnalysisDfd = { id: "dfd", numero_protocolo: "DFD-1", objeto_contratacao: "Material", justificativa_contratacao: "Uso", status: "triagem", requester: "Pessoa", sector: "Setor", created_at: evaluation.updatedAt, valor_total_estimado: 40, revision: "base", items: [ownItem], draft: null, evaluations: [evaluation] };
  const session = new AnalysisSession({ dfd, actorId: "admin", send: async () => { throw new Error("consulta não envia operação"); } });
  assert.equal(session.getSnapshot().working.items[0].criticidade, null);
  assert.equal(session.getDfd().evaluations?.[0].items[0].criticidade, "alta");
  assert.equal(session.getSnapshot().dirty, false);
  session.dispose();
});

test("avaliação desatualizada informa mudança da DFD e ausência de foto tem identificação", () => {
  const html = renderToStaticMarkup(React.createElement(SavedItemEvaluations, { evaluations: [{ ...evaluation, avatarUrl: null }], itemId: "item", revision: "changed" }));
  assert.match(html, /A DFD mudou após esta avaliação/);
  assert.match(html, /Ana Chefia/);
  assert.doesNotMatch(html, /<img/);
});
