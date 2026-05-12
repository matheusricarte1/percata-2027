import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCusteioKitDescription,
  UNIVERSITY_CUSTEIO_KIT_TEMPLATES,
} from "./university-custeio-kits.ts";

describe("university-custeio-kits", () => {
  it("covers gestão, ensino, pesquisa and extensão", () => {
    const eixos = new Set(UNIVERSITY_CUSTEIO_KIT_TEMPLATES.map((template) => template.eixo));

    assert.deepEqual(Array.from(eixos).sort(), ["ensino", "extensao", "gestao", "pesquisa"]);
  });

  it("keeps each kit complete enough to become a DFD model", () => {
    for (const template of UNIVERSITY_CUSTEIO_KIT_TEMPLATES) {
      assert(template.objeto.length > 40);
      assert(template.finalidadeInstitucional.length > 80);
      assert(template.justificativaContratacao.length > 220);
      assert(template.justificativaQuantidade.length > 160);
      assert(template.contextoUso.length > 80);
      assert(template.orientacaoUso.length > 80);
      assert(template.cuidadosAntesEnvio.length >= 3);
      assert(template.itens.length >= 8);
      assert(template.itens.every((item) => item.codigoEfisco && item.quantidade > 0));
      assert(template.itens.every((item) => item.aplicacaoTecnica.length > 40));
    }
  });

  it("states that the kit is custeio and must not mix capital", () => {
    const description = buildCusteioKitDescription(UNIVERSITY_CUSTEIO_KIT_TEMPLATES[0]);

    assert.match(description, /Objeto da DFD/i);
    assert.match(description, /Justificativa da necessidade/i);
    assert.match(description, /Base de cálculo e dimensionamento/i);
    assert.match(description, /Natureza: custeio/i);
    assert.match(description, /Não misturar com itens de capital/i);
  });

  it("offers more than one model for repeated academic contexts", () => {
    assert(UNIVERSITY_CUSTEIO_KIT_TEMPLATES.length >= 8);
  });
});
