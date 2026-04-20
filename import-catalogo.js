const fs = require('fs');
const { parse } = require('csv-parse');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Credenciais do Supabase não encontradas!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importCatalogo() {
  console.log('🚀 Iniciando importação FINAL (com suporte a BOM)...');
  
  const csvFilePath = 'C:\\Users\\Mac-PC\\Downloads\\PERCATA\\extrac_a_o_itens_ativos.csv';
  
  // Truncar antes de começar para garantir limpeza total
  await supabase.from('catalogo').delete().neq('id', 0); // Hack para truncar via API se necessário

  const parser = fs.createReadStream(csvFilePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      delimiter: ';',
      trim: true,
      bom: true // <<--- ESSENCIAL: Ignora o caractere invisível do Excel
    })
  );

  let batch = [];
  let totalImported = 0;
  const BATCH_SIZE = 1000;

  for await (const record of parser) {
    batch.push({
      codigo_efisco: record['EFISCO'],
      descricao: record['DESCRIÇÃO DO PRODUTO'],
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
        if (totalImported % 10000 === 0) console.log(`✅ Progressão: ${totalImported} itens...`);
      }
      batch = [];
    }
  }

  if (batch.length > 0) {
    await supabase.from('catalogo').upsert(batch, { onConflict: 'codigo_efisco' });
    totalImported += batch.length;
  }

  console.log(`🏁 VITÓRIA! Importação concluída: ${totalImported} itens.`);
}

importCatalogo().catch(err => {
  console.error('❌ Erro fatal:', err);
});
