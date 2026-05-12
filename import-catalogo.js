const fs = require("fs");
const { parse } = require("csv-parse");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Credenciais do Supabase não encontradas.");
  process.exit(1);
}

const csvFilePath =
  process.env.EFISCO_CSV_PATH ||
  "C:\\Users\\Mac-PC\\Downloads\\PERCATA\\catalogo_itens_efisco_ativos_17042026.csv";

const BATCH_SIZE = Number(process.env.IMPORT_BATCH_SIZE || 1000);
const SEM_NATUREZA_KEY = "__SEM_NATUREZA__";

const supabase = createClient(supabaseUrl, supabaseKey);

function clean(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

function normalizeTipoObjeto(value) {
  const text = clean(value);
  if (!text) return null;
  return text.toUpperCase() === "SERVIÇO" ? "SERVIÇO" : text.toUpperCase();
}

function normalizeMaterialCategoria(tipoObjeto) {
  return tipoObjeto === "SERVIÇO" ? "Serviço" : "Material";
}

function deriveGnd(codigoNatureza) {
  const value = clean(codigoNatureza);
  if (!value || value.length < 6) return null;
  return `${value[0]}.${value[1]}.${value.slice(2, 4)}.${value.slice(4, 6)}`;
}

function parseEfiscoDate(value) {
  const text = clean(value);
  if (!text) return null;
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, day, month, year, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

async function upsertBatch(table, rows, options) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, options);
  if (error) throw error;
}

async function fetchCatalogIds(codes) {
  const result = new Map();
  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const chunk = codes.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("catalogo")
      .select("id,codigo_efisco")
      .in("codigo_efisco", chunk);
    if (error) throw error;

    for (const row of data || []) {
      result.set(row.codigo_efisco, row.id);
    }
  }
  return result;
}

async function importCatalogo() {
  console.log(`Iniciando importação e-Fisco: ${csvFilePath}`);

  const catalogoByCodigo = new Map();
  const naturezasByCodigo = new Map();
  let totalRows = 0;

  const parser = fs.createReadStream(csvFilePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      delimiter: ";",
      trim: true,
      bom: true,
      relax_column_count: true,
    }),
  );

  for await (const record of parser) {
    totalRows += 1;
    const codigoItem = clean(record.CODIGO_ITEM);
    if (!codigoItem) continue;

    const tipoObjeto = normalizeTipoObjeto(record.TIPO_OBJETO);
    const codigoNatureza = clean(record.CODIGO_NATUREZA_DESPESA);
    const naturezaKey = codigoNatureza || SEM_NATUREZA_KEY;
    const gnd = deriveGnd(codigoNatureza);

    if (!catalogoByCodigo.has(codigoItem)) {
      catalogoByCodigo.set(codigoItem, {
        codigo_efisco: codigoItem,
        descricao: clean(record.NOME_ITEM),
        tipo: normalizeMaterialCategoria(tipoObjeto),
        categoria: normalizeMaterialCategoria(tipoObjeto),
        grupo: clean(record.NOME_GRUPO),
        classe: clean(record.NOME_CLASSE),
        tipo_objeto: tipoObjeto,
        codigo_grupo: clean(record.CODIGO_GRUPO),
        nome_grupo: clean(record.NOME_GRUPO),
        descricao_grupo: clean(record.DESCRICAO_GRUPO),
        situacao_grupo: clean(record.SITUACAO_GRUPO),
        codigo_classe: clean(record.CODIGO_CLASSE),
        nome_classe: clean(record.NOME_CLASSE),
        descricao_classe: clean(record.DESCRICAO_CLASSE),
        situacao_classe: clean(record.SITUACAO_CLASSE),
        codigo_material_servico: clean(record.CODIGO_MATERIAL_SERVICO),
        nome_material_servico: clean(record.NOME_MATERIAL_SERVICO),
        situacao_material_servico: clean(record.SITUACAO_MATERIAL_SERVICO),
        data_inclusao_item: parseEfiscoDate(record.DATA_INCLUSAO_ITEM),
        situacao_item: clean(record.SITUACAO_ITEM),
        codigo_natureza_preferencial: codigoNatureza,
        gnd_preferencial: gnd,
        natureza_count: 0,
        unidade_medida: "UN",
      });
    }

    if (!naturezasByCodigo.has(codigoItem)) {
      naturezasByCodigo.set(codigoItem, new Map());
    }

    const naturezas = naturezasByCodigo.get(codigoItem);
    if (!naturezas.has(naturezaKey)) {
      naturezas.set(naturezaKey, {
        codigo_item: codigoItem,
        codigo_natureza_despesa: codigoNatureza,
        natureza_key: naturezaKey,
        gnd,
      });
    }

    if (totalRows % 100000 === 0) {
      console.log(`Lidas ${totalRows} linhas...`);
    }
  }

  for (const [codigoItem, item] of catalogoByCodigo.entries()) {
    const naturezas = Array.from(naturezasByCodigo.get(codigoItem)?.values() || []);
    item.natureza_count = naturezas.length;
    const firstWithNatureza = naturezas.find((n) => n.codigo_natureza_despesa);
    if (firstWithNatureza) {
      item.codigo_natureza_preferencial = firstWithNatureza.codigo_natureza_despesa;
      item.gnd_preferencial = firstWithNatureza.gnd;
    }
  }

  console.log(
    `Preparados ${catalogoByCodigo.size} itens e ${Array.from(
      naturezasByCodigo.values(),
    ).reduce((acc, item) => acc + item.size, 0)} naturezas.`,
  );

  const catalogRows = Array.from(catalogoByCodigo.values());
  for (let i = 0; i < catalogRows.length; i += BATCH_SIZE) {
    await upsertBatch("catalogo", catalogRows.slice(i, i + BATCH_SIZE), {
      onConflict: "codigo_efisco",
    });
    if ((i + BATCH_SIZE) % 10000 === 0) {
      console.log(`Itens importados: ${Math.min(i + BATCH_SIZE, catalogRows.length)}`);
    }
  }

  console.log("Resolvendo IDs internos do catálogo...");
  const catalogIds = await fetchCatalogIds(Array.from(catalogoByCodigo.keys()));

  let totalNaturezas = 0;
  let naturezaBatch = [];
  for (const naturezas of naturezasByCodigo.values()) {
    for (const row of naturezas.values()) {
      row.catalogo_id = catalogIds.get(row.codigo_item) || null;
      naturezaBatch.push(row);
      if (naturezaBatch.length >= BATCH_SIZE) {
        await upsertBatch("catalogo_item_naturezas", naturezaBatch, {
          onConflict: "codigo_item,natureza_key",
        });
        totalNaturezas += naturezaBatch.length;
        if (totalNaturezas % 50000 === 0) {
          console.log(`Naturezas importadas: ${totalNaturezas}`);
        }
        naturezaBatch = [];
      }
    }
  }
  if (naturezaBatch.length > 0) {
    await upsertBatch("catalogo_item_naturezas", naturezaBatch, {
      onConflict: "codigo_item,natureza_key",
    });
    totalNaturezas += naturezaBatch.length;
  }

  console.log(
    `Importação concluída: ${catalogRows.length} itens, ${totalNaturezas} naturezas, ${totalRows} linhas lidas.`,
  );
}

importCatalogo().catch((err) => {
  console.error("Erro fatal na importação:", err);
  process.exit(1);
});
