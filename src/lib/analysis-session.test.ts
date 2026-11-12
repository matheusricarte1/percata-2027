import assert from "node:assert/strict";
import test from "node:test";
import {
  AnalysisSession,
  type AnalysisSessionTransport,
} from "./analysis-session";
import type { AnalysisDfd } from "./dfd-analysis";
const fixture = (): AnalysisDfd => ({
  id: "dfd",
  numero_protocolo: "DFD-TESTE",
  requester: "Ana",
  sector: "Biblioteca",
  objeto_contratacao: "Mobiliário",
  justificativa_contratacao: "Atendimento",
  created_at: "2026-09-01",
  valor_total_estimado: 100,
  status: "triagem",
  revision: "base",
  draft: null,
  items: [
    {
      id: "item",
      descricao: "Mesa",
      quantidade: 1,
      valor_unitario_estimado: 100,
      criticidade: "alta",
      moscow_categoria: "deve_ter",
      is_highlight_item: false,
    },
  ],
});
const storage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) || null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    map,
  };
};
function setup(custom?: AnalysisSessionTransport) {
  const bodies: Record<string, unknown>[] = [];
  let revision = 0;
  const store = storage();
  const send: AnalysisSessionTransport =
    custom ||
    (async (b) => {
      bodies.push(b);
      if (b.action === "save_draft")
        return {
          ok: true,
          draft: {
            revision: ++revision,
            base_revision: "base",
            updated_at: "2026-09-06",
            payload: {
              items: b.items as AnalysisDfd["items"],
              reason: String(b.reason || ""),
            },
          },
        };
      return {
        ok: true,
        revision: "next",
        items: b.items as AnalysisDfd["items"],
        status: b.action === "return" ? "devolvida" : "aprovada",
      };
    });
  const session = new AnalysisSession({
    dfd: fixture(),
    actorId: "actor",
    send,
    storage: store,
    debounceMs: 10,
  });
  session.start();
  return { session, store, bodies };
}
test("desmontar o editor não interrompe o salvamento da sessão", async () => {
  const { session, bodies } = setup();
  const off = session.subscribe(() => {});
  session.updateItem("item", { quantidade: 3 });
  off();
  await new Promise((r) => setTimeout(r, 35));
  assert.equal(bodies.length, 1);
  assert.equal(session.getSnapshot().dirty, false);
  assert.equal(session.getDfd().draft?.payload.items[0].quantidade, 3);
  session.dispose();
});
test("resposta incerta reutiliza UUID e payload, inclusive após recarga", async () => {
  let first: Record<string, unknown> | undefined;
  const store = storage();
  const send: AnalysisSessionTransport = async (b) => {
    first = b;
    throw new Error("offline");
  };
  const session = new AnalysisSession({
    dfd: fixture(),
    actorId: "actor",
    send,
    storage: store,
  });
  session.start();
  session.updateItem("item", { quantidade: 2 });
  await assert.rejects(session.save());
  session.dispose();
  let retry: Record<string, unknown> | undefined;
  const next = new AnalysisSession({
    dfd: fixture(),
    actorId: "actor",
    storage: store,
    send: async (b) => {
      retry = b;
      return {
        ok: true,
        draft: {
          revision: 1,
          base_revision: "base",
          updated_at: "now",
          payload: { items: b.items as AnalysisDfd["items"] },
        },
      };
    },
  });
  next.start();
  await next.retry();
  assert.deepEqual(retry, first);
  assert.equal(next.getSnapshot().dirty, false);
  next.dispose();
});
test("edição durante gravação é enviada depois da confirmação anterior", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  const values: number[] = [];
  const { session } = setup(async (b) => {
    values.push((b.items as AnalysisDfd["items"])[0].quantidade);
    if (values.length === 1) await gate;
    return {
      ok: true,
      draft: {
        revision: values.length,
        base_revision: "base",
        updated_at: "now",
        payload: { items: b.items as AnalysisDfd["items"] },
      },
    };
  });
  session.updateItem("item", { quantidade: 2 });
  const flight = session.save();
  session.updateItem("item", { quantidade: 3 });
  release();
  await flight;
  assert.deepEqual(values, [2, 3]);
  assert.equal(session.getSnapshot().dirty, false);
  session.dispose();
});
test("quantidade inválida fica pendente sem falso sucesso", async () => {
  const { session, bodies } = setup();
  session.updateItem("item", { quantidade: NaN });
  await assert.rejects(session.save());
  assert.equal(bodies.length, 0);
  assert.equal(session.getSnapshot().dirty, true);
  session.dispose();
});
test("janela fechada permite rascunho mas não decisão", async () => {
  const { session, bodies } = setup();
  session.updateItem("item", { quantidade: 2 });
  await session.save();
  await assert.rejects(session.perform("approve", false), /fechado/);
  assert.equal(bodies.length, 1);
  session.dispose();
});
test("conflito preserva edição e exige comparação antes de reaplicar", async () => {
  const { session } = setup();
  session.updateItem("item", { quantidade: 3 });
  const fresh = fixture();
  fresh.revision = "concurrent";
  fresh.items[0].quantidade = 2;
  session.replaceDfd(fresh);
  assert.equal(session.getSnapshot().conflict, true);
  session.reapply();
  assert.equal(session.getSnapshot().conflict, true);
  session.setCompared(true);
  session.reapply();
  assert.equal(session.getSnapshot().conflict, false);
  assert.equal(session.getSnapshot().working.items[0].quantidade, 3);
  session.dispose();
});
test("devolução compila orientações por item sem duplicar o motivo geral", async () => {
  const { session, bodies } = setup();
  session.updateItem("item", { correctionNote: "Informar local de uso" });
  await session.perform("return", true);
  const decision = bodies.find((b) => b.action === "return")!;
  assert.match(String(decision.reason), /Mesa \[item\]: Informar local de uso/);
  assert.equal(session.getDfd().status, "devolvida");
  assert.equal(session.getSnapshot().dirty, false);
  session.dispose();
});
test("homologação bloqueia campos ausentes e último item retirado", async () => {
  const { session } = setup();
  session.updateItem("item", { criticidade: null });
  await assert.rejects(
    session.perform("approve", true),
    /prioridade e o impacto/,
  );
  session.updateItem("item", { remove: true, removalReason: "Duplicado" });
  await assert.rejects(session.perform("approve", true), /sem itens/);
  session.dispose();
});
test("decisão incerta trava edição e confere o pedido mesmo após fechar calendário", async () => {
  const bodies: Record<string, unknown>[] = [];
  let failed = false;
  const { session } = setup(async (b) => {
    bodies.push(b);
    if (!failed) {
      failed = true;
      throw new Error("timeout");
    }
    return {
      ok: true,
      revision: "next",
      status: "aprovada",
      items: fixture().items,
    };
  });
  await assert.rejects(session.perform("approve", true));
  assert.equal(session.getSnapshot().pendingFormal, true);
  session.updateItem("item", { quantidade: 99 });
  assert.equal(session.getSnapshot().working.items[0].quantidade, 1);
  await session.retry();
  assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(session.getSnapshot().pendingFormal, false);
  session.dispose();
});

test("arrastar suspende o envio e soltar retoma o salvamento após a pausa", async () => {
  const { session, bodies } = setup();
  try {
    session.updateItem("item", { criticidade: "media" });
    session.beginInteraction();
    await new Promise((resolve) => setTimeout(resolve, 35));
    assert.equal(bodies.length, 0);
    session.updateItem("item", { criticidade: "baixa" });
    await new Promise((resolve) => setTimeout(resolve, 35));
    assert.equal(bodies.length, 0);
    session.endInteraction();
    await new Promise((resolve) => setTimeout(resolve, 35));
    assert.equal(bodies.length, 1);
    assert.equal((bodies[0].items as AnalysisDfd["items"])[0].criticidade, "baixa");
    assert.equal(session.getSnapshot().dirty, false);
  } finally { session.dispose(); }
});


test("resposta de rascunho mantém compatibilidade com envio manual quando o automático está desativado", async () => {
  const { session, bodies } = setup();
  session.updateItem("item", { criticidade: "critica", moscow_categoria: "deve_ter" });
  await session.save();
  assert.equal(session.getDfd().status, "triagem");
  assert.ok(session.getDfd().draft);
  assert.ok(bodies.every((body) => body.action === "save_draft"));
  session.updateItem("item", { criticidade: "media" });
  await session.save();
  assert.equal(session.getDfd().status, "triagem");
  await session.perform("approve", true);
  assert.equal(bodies.at(-1)?.action, "approve");
  assert.equal(session.getDfd().status, "aprovada");
  session.dispose();
});

test("salvamento com encaminhamento automático limpa o rascunho e não duplica a aprovação", async () => {
  const bodies: Record<string, unknown>[] = [];
  const { session, store } = setup(async body => {
    bodies.push(body);
    return { ok: true, autoSubmitted: true, status: "aprovada", revision: "final", items: body.items as AnalysisDfd["items"], total: 300 };
  });
  session.updateItem("item", { quantidade: 3 });
  await session.perform("approve", true);
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].action, "save_draft");
  assert.equal(session.getDfd().status, "aprovada");
  assert.equal(session.getDfd().draft, null);
  assert.equal(session.getSnapshot().dirty, false);
  assert.match(session.getSnapshot().saveState, /encaminhada à consolidação/);
  assert.equal(store.map.size, 0);
  session.dispose();
});
