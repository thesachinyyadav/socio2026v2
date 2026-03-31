import ExcelJS from "exceljs";

const PRIMARY_ARGB = "FF0F4C81";
const SECTION_ARGB = "FF0C3D67";
const BORDER_ARGB = "FFE2E8F0";
const STRIPED_ROW_ARGB = "FFF6FAFF";
const SURFACE_ARGB = "FFF8FAFC";

export type XlsxCellPrimitive = string | number | null | undefined;

export type XlsxColumnKind =
  | "text"
  | "number"
  | "currency"
  | "status"
  | "ticket"
  | "email"
  | "link";

export type HorizontalAlign = "left" | "center" | "right";

export type ThemedSheetColumn<T extends Record<string, XlsxCellPrimitive>> = {
  header: string;
  key: keyof T & string;
  width: number;
  kind?: XlsxColumnKind;
  horizontal?: HorizontalAlign;
  wrapText?: boolean;
};

export type SummarySection = {
  title: string;
  rows: Array<{ label: string; value: string | number }>;
};

type SummarySheetOptions = {
  title: string;
  subtitle?: string;
  sections: SummarySection[];
  sheetName?: string;
  columnWidths?: [number, number];
};

type DataSheetOptions<T extends Record<string, XlsxCellPrimitive>> = {
  sheetName: string;
  columns: Array<ThemedSheetColumn<T>>;
  rows: T[];
  freezeHeader?: boolean;
  autoFilter?: boolean;
  rowHeight?: number;
};

function toExcelColumnLabel(index: number): string {
  let value = index;
  let output = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }

  return output;
}

function getStatusCellStyle(status: string): { fill: string; text: string } {
  switch (status.toLowerCase()) {
    case "attended":
      return { fill: "FFDCFCE7", text: "FF166534" };
    case "absent":
      return { fill: "FFFEE2E2", text: "FFB91C1C" };
    case "pending":
      return { fill: "FFFEF3C7", text: "FF92400E" };
    default:
      return { fill: "FFE2E8F0", text: "FF475569" };
  }
}

function getTicketTypeCellStyle(ticketType: string): { fill: string; text: string } {
  switch (ticketType.toLowerCase()) {
    case "outsider":
      return { fill: "FFFEF3C7", text: "FF92400E" };
    case "team":
      return { fill: "FFCCFBF1", text: "FF0F766E" };
    case "individual":
      return { fill: "FFDBEAFE", text: "FF1D4ED8" };
    default:
      return { fill: "FFE2E8F0", text: "FF475569" };
  }
}

function setCellBorder(cell: ExcelJS.Cell): void {
  cell.border = {
    top: { style: "thin", color: { argb: BORDER_ARGB } },
    left: { style: "thin", color: { argb: BORDER_ARGB } },
    bottom: { style: "thin", color: { argb: BORDER_ARGB } },
    right: { style: "thin", color: { argb: BORDER_ARGB } },
  };
}

export function createThemedWorkbook(creator = "SOCIO Master Admin"): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = creator;
  workbook.created = new Date();
  return workbook;
}

export function addStructuredSummarySheet(
  workbook: ExcelJS.Workbook,
  options: SummarySheetOptions
): ExcelJS.Worksheet {
  const summarySheet = workbook.addWorksheet(options.sheetName ?? "Summary");
  const [leftWidth, rightWidth] = options.columnWidths ?? [34, 70];

  summarySheet.columns = [
    { header: "Field", key: "field", width: leftWidth },
    { header: "Value", key: "value", width: rightWidth },
  ];

  summarySheet.mergeCells("A1:B1");
  const titleCell = summarySheet.getCell("A1");
  titleCell.value = options.title;
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_ARGB } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  summarySheet.getRow(1).height = 24;

  if (options.subtitle) {
    const subtitleCell = summarySheet.getCell("A2");
    subtitleCell.value = options.subtitle;
    subtitleCell.font = { italic: true, color: { argb: "FF64748B" } };
  }

  let writeRow = options.subtitle ? 4 : 3;

  options.sections.forEach((section) => {
    summarySheet.mergeCells(`A${writeRow}:B${writeRow}`);
    const sectionTitleCell = summarySheet.getCell(`A${writeRow}`);
    sectionTitleCell.value = section.title;
    sectionTitleCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    sectionTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECTION_ARGB } };
    sectionTitleCell.alignment = { horizontal: "left", vertical: "middle" };
    summarySheet.getRow(writeRow).height = 20;
    writeRow += 1;

    const sectionHeaderRow = summarySheet.getRow(writeRow);
    sectionHeaderRow.values = ["Field", "Value"];
    sectionHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    sectionHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_ARGB } };
    sectionHeaderRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: SECTION_ARGB } },
        left: { style: "thin", color: { argb: SECTION_ARGB } },
        bottom: { style: "thin", color: { argb: SECTION_ARGB } },
        right: { style: "thin", color: { argb: SECTION_ARGB } },
      };
    });
    writeRow += 1;

    section.rows.forEach((entry, sectionIndex) => {
      const row = summarySheet.getRow(writeRow);
      row.values = [entry.label, String(entry.value)];

      row.eachCell((cell, columnNumber) => {
        setCellBorder(cell);
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

        if (sectionIndex % 2 === 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SURFACE_ARGB } };
        }

        if (columnNumber === 1) {
          cell.font = { bold: true, color: { argb: "FF334155" } };
        }
      });

      writeRow += 1;
    });

    writeRow += 1;
  });

  return summarySheet;
}

export function addStructuredTableSheet<T extends Record<string, XlsxCellPrimitive>>(
  workbook: ExcelJS.Workbook,
  options: DataSheetOptions<T>
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(
    options.sheetName,
    options.freezeHeader === false ? undefined : { views: [{ state: "frozen", ySplit: 1 }] }
  );

  worksheet.columns = options.columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));

  options.rows.forEach((rowData) => {
    const rowValues = options.columns.map((column) => rowData[column.key] ?? "");
    worksheet.addRow(rowValues);
  });

  const headerRow = worksheet.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_ARGB } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: SECTION_ARGB } },
      left: { style: "thin", color: { argb: SECTION_ARGB } },
      bottom: { style: "thin", color: { argb: SECTION_ARGB } },
      right: { style: "thin", color: { argb: SECTION_ARGB } },
    };
  });

  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);

    if (options.rowHeight) {
      row.height = options.rowHeight;
    }

    options.columns.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      setCellBorder(cell);

      const shouldWrap = column.wrapText ?? true;
      const horizontalAlign: HorizontalAlign =
        column.horizontal ?? (column.kind === "number" || column.kind === "currency" ? "right" : "left");

      cell.alignment = {
        vertical: "middle",
        horizontal: horizontalAlign,
        wrapText: shouldWrap,
      };

      if (rowIndex % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STRIPED_ROW_ARGB } };
      }

      const rawValue = cell.value;
      const textValue = typeof rawValue === "string" ? rawValue : String(rawValue ?? "");

      if (column.kind === "currency") {
        cell.numFmt = '"INR" #,##0';
      }

      if (column.kind === "status") {
        const style = getStatusCellStyle(textValue);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.fill } };
        cell.font = { bold: true, color: { argb: style.text } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }

      if (column.kind === "ticket") {
        const style = getTicketTypeCellStyle(textValue);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.fill } };
        cell.font = { bold: true, color: { argb: style.text } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }

      if (column.kind === "email" && textValue) {
        cell.value = { text: textValue, hyperlink: `mailto:${textValue}` };
        cell.font = { color: { argb: "FF1D4ED8" }, underline: true };
      }

      if (column.kind === "link" && /^https?:\/\//i.test(textValue)) {
        cell.value = { text: textValue, hyperlink: textValue };
        cell.font = { color: { argb: "FF1D4ED8" }, underline: true };
      }
    });
  }

  if (options.autoFilter !== false && options.columns.length > 0) {
    worksheet.autoFilter = `A1:${toExcelColumnLabel(options.columns.length)}1`;
  }

  return worksheet;
}

export async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.toLowerCase().endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
