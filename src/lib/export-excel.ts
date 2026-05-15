type WorkbookSheet = {
  name: string;
  rows: Array<Record<string, unknown>>;
};

function sanitizeSheetName(name: string) {
  return String(name || "Planilha")
    .replace(/[:\\/?*[\]]/g, "_")
    .slice(0, 31);
}

function protectExcelCell(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trimStart();
  if (/^[=+\-@]/.test(trimmed)) return `'${value}`;
  return value;
}

function collectHeaders(rows: Array<Record<string, unknown>>) {
  const headers = new Set<string>();
  for (const row of rows) {
    Object.keys(row).forEach((key) => headers.add(key));
  }
  return Array.from(headers);
}

export async function downloadWorkbookFromSheets(sheets: WorkbookSheet[], filename: string) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PERCATA";
  workbook.created = new Date();

  for (const sheet of sheets) {
    const rows = sheet.rows || [];
    const worksheet = workbook.addWorksheet(sanitizeSheetName(sheet.name));
    const headers = collectHeaders(rows);
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.max(12, Math.min(42, header.length + 4)),
    }));

    for (const row of rows) {
      const safeRow = Object.fromEntries(
        headers.map((header) => [header, protectExcelCell(row[header])]),
      );
      worksheet.addRow(safeRow);
    }

    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
