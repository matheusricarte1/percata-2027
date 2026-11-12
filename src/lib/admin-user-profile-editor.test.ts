import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const pageSource = readFileSync(
  path.join(process.cwd(), "src/app/(admin)/admin/usuarios/page.tsx"),
  "utf8",
);

test("editor de perfil oferece busca antes de listar o catalogo de laboratorios", () => {
  assert.match(pageSource, /Buscar laborat[oó]rio/);
  assert.match(pageSource, /Gerenciar laborat[oó]rios/);
  assert.match(pageSource, /max-h-/);
});

test("editor permite selecionar varios departamentos com papel individual", () => {
  assert.match(pageSource, /Setores vinculados/);
  assert.match(pageSource, /editingDepartamentos/);
});

test("resumo trata chefia por unidade sem depender do setor legado", () => {
  assert.match(pageSource, /Chefia de Unidades/);
  assert.match(pageSource, /Chefia:/);
  assert.match(pageSource, /hasChefiaUnit\(user\)/);
  assert.doesNotMatch(pageSource, /user\.departamento_role === "chefia"/);
});

test("editor diferencia nenhum laboratorio vinculado de campus ausente", () => {
  assert.match(pageSource, /Nenhum laboratório vinculado/);
  assert.match(pageSource, /Selecione um campus para listar os laboratórios/);
});

test("lista de usuários mantém lotação compacta e ações reservadas por coluna", () => {
  assert.match(pageSource, /<div className="overflow-x-auto rounded-\[24px\]/);
  assert.match(pageSource, /<table className="min-w-\[1040px\] w-full table-fixed border-collapse text-left text-sm">/);
  assert.match(pageSource, /<col className="w-\[12%\]" \/>/);
  assert.match(pageSource, /min-w-\[88px\] justify-end gap-2/);
  assert.match(pageSource, /line-clamp-2/);
  assert.doesNotMatch(pageSource, /<td className="p-8">/);
  assert.doesNotMatch(pageSource, /rounded-xl border border-emerald-100 bg-emerald-50\/70/);
});

test("perfil não usa seletor largo dentro da linha e mantém chefia como dois acessos", () => {
  assert.doesNotMatch(pageSource, /CHEFIA DE UNIDADES \+ SOLICITANTE/);
  assert.match(pageSource, /Chefia[\s\S]*Solicitante/);
  assert.match(pageSource, /Editar perfil e vínculos/);
});
