const fs = require('fs');
const path = require('path');

const csvPath = path.resolve(__dirname, '../../extrac_a_o_itens_ativos.csv');
const content = fs.readFileSync(csvPath, 'latin1'); // EFISCO uses latin1 usually for PT characters
const lines = content.split('\n');

const items = [];
const header = lines[0].split(';');

// Process top 1000 items
for (let i = 1; i < 1500 && i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const cols = line.split(';');
  if (cols.length < 2) continue;

  const efisco = cols[0];
  const descricao = cols[1].replace(/'/g, "''"); // Escape single quotes
  const tipo = cols[2];
  const categoria = cols[3];
  
  // Decide a GND based on type/category
  let gnd = '3.3.90.30'; // Default Material Consumption
  if (descricao.includes('NOTEBOOK') || descricao.includes('MONITOR') || descricao.includes('IMPRESSORA')) {
    gnd = '4.4.90.52'; // Equipment
  } else if (tipo === 'Servio') {
    gnd = '3.3.90.39'; // Services
  }
  
  const valor = (Math.random() * 500 + 10).toFixed(2); // Mock a base price for prototype

  items.push(`('${efisco}', '${descricao}', '${gnd}', ${valor})`);
}

const sql = `INSERT INTO catalogo_efisco (codigo_tce, descricao, gnd, valor_estimado_base) VALUES 
${items.join(',\n')}
ON CONFLICT (codigo_tce) DO UPDATE SET 
  descricao = EXCLUDED.descricao,
  gnd = EXCLUDED.gnd,
  valor_estimado_base = EXCLUDED.valor_estimado_base;`;

fs.writeFileSync(path.resolve(__dirname, 'import_efisco.sql'), sql);
console.log('SQL generated with ' + items.length + ' items.');
