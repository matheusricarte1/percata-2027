const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { createClient } = require('@supabase/supabase-js');

// Configuração (Pegando das variáveis que já usamos)
const SUPABASE_URL = 'https://hudbtcobpbyfkpcgosuu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uCI0c3Y5_DEUBc2o9CMbTA_6fE36m-O'; // Anon Key

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const csvFilePath = path.join(__dirname, '..', 'extrac_a_o_itens_ativos.csv');

async function importData() {
  console.log('🚀 Iniciando importação do catálogo...');
  
  const parser = fs.createReadStream(csvFilePath).pipe(
    parse({
      delimiter: ';',
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true
    })
  );

  let batch = [];
  let totalImported = 0;
  const BATCH_SIZE = 100;

  for await (const record of parser) {
    batch.push({
      codigo_efisco: record['EFISCO'],
      descricao: record['DESCRIÇÃO DO PRODUTO'] || record['DESCRIO DO PRODUTO'],
      tipo: record['TIPO PRODUTO'],
      categoria: record['CATEGORIA PRODUTO'],
      grupo: record['GRUPO'],
      classe: record['CLASSE']
    });

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from('catalogo').upsert(batch, { onConflict: 'codigo_efisco' });
      if (error) {
        console.error('❌ Erro no lote:', error.message);
      } else {
        totalImported += batch.length;
        console.log(`✅ Importados: ${totalImported} itens...`);
      }
      batch = [];
    }

    // Limite inicial para teste rápido
    if (totalImported >= 2000) break;
  }

  if (batch.length > 0) {
    await supabase.from('catalogo').upsert(batch, { onConflict: 'codigo_efisco' });
  }

  console.log('🏁 Importação finalizada com sucesso!');
}

importData().catch(console.error);
