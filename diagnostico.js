const fs = require('fs');
const { parse } = require('csv-parse');

const csvFilePath = 'C:\\Users\\Mac-PC\\Downloads\\PERCATA\\extrac_a_o_itens_ativos.csv';

async function diagnose() {
  const parser = fs.createReadStream(csvFilePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      delimiter: ';',
      trim: true,
      to_line: 5 // Só os primeiros 5
    })
  );

  for await (const record of parser) {
    console.log('--- REGISTRO ENCONTRADO ---');
    console.log(JSON.stringify(record, null, 2));
    console.log('Chaves disponíveis:', Object.keys(record));
    break; // Só o primeiro
  }
}

diagnose().catch(console.error);
