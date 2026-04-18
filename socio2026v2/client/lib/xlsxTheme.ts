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

export type XlsxChartType = "bar" | "line" | "donut";

export type XlsxChartDataPoint = {
  label: string;
  value: number;
  color?: string;
};

export type XlsxChartDefinition = {
  title: string;
  type: XlsxChartType;
  data: XlsxChartDataPoint[];
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

type ChartsSheetOptions = {
  title: string;
  subtitle?: string;
  sheetName?: string;
  primaryChart: XlsxChartDefinition;
  secondaryChart?: XlsxChartDefinition;
};

const DEFAULT_CHART_COLORS = [
  "#0F4C81",
  "#0EA5A4",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#16A34A",
  "#0EA5E9",
  "#F97316",
];

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

function createChartCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;
  return { canvas, ctx };
}

function drawChartCardBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
}

function normalizeChartData(data: XlsxChartDataPoint[]): XlsxChartDataPoint[] {
  return data
    .map((point) => ({
      label: String(point.label || "Unknown"),
      value: Number.isFinite(point.value) ? Number(point.value) : 0,
      color: point.color,
    }))
    .filter((point) => point.label.length > 0);
}

function chartDataToBase64(chart: XlsxChartDefinition, width: number, height: number): string | null {
  const normalized = normalizeChartData(chart.data);
  const chartCanvas = createChartCanvas(width, height);

  if (!chartCanvas) return null;
  const { canvas, ctx } = chartCanvas;

  drawChartCardBackground(ctx, width, height);

  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 16px Segoe UI";
  ctx.fillText(chart.title, 20, 30);

  if (normalized.length === 0) {
    ctx.fillStyle = "#64748B";
    ctx.font = "13px Segoe UI";
    ctx.fillText("No data available for this chart.", 20, 62);
    return canvas.toDataURL("image/png").split(",")[1];
  }

  if (chart.type === "donut") {
    const total = normalized.reduce((sum, point) => sum + point.value, 0);
    const centerX = Math.round(width * 0.3);
    const centerY = Math.round(height * 0.58);
    const outerRadius = Math.min(110, Math.round(height * 0.34));
    const innerRadius = Math.round(outerRadius * 0.58);
    let currentAngle = -Math.PI / 2;

    normalized.forEach((point, index) => {
      const ratio = total > 0 ? point.value / total : 0;
      const angle = ratio * 2 * Math.PI;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, outerRadius, currentAngle, currentAngle + angle);
      ctx.closePath();
      ctx.fillStyle = point.color ?? DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length];
      ctx.fill();

      currentAngle += angle;
    });

    ctx.beginPath();
    ctx.fillStyle = "#FFFFFF";
    ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 20px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(total.toLocaleString(), centerX, centerY + 6);
    ctx.font = "12px Segoe UI";
    ctx.fillStyle = "#64748B";
    ctx.fillText("Total", centerX, centerY + 24);
    ctx.textAlign = "left";

    let legendY = 58;
    normalized.slice(0, 10).forEach((point, index) => {
      const color = point.color ?? DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length];
      const percentage = total > 0 ? (point.value / total) * 100 : 0;

      ctx.fillStyle = color;
      ctx.fillRect(Math.round(width * 0.58), legendY - 8, 12, 12);
      ctx.fillStyle = "#334155";
      ctx.font = "12px Segoe UI";
      ctx.fillText(
        `${point.label.slice(0, 22)} (${percentage.toFixed(1)}%)`,
        Math.round(width * 0.58) + 18,
        legendY + 2
      );
      legendY += 22;
    });

    return canvas.toDataURL("image/png").split(",")[1];
  }

  const plot = {
    left: 60,
    top: 52,
    width: width - 95,
    height: height - 100,
  };

  const maxValue = Math.max(1, ...normalized.map((point) => point.value));

  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const y = plot.top + (plot.height / 4) * index;
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.left + plot.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#CBD5E1";
  ctx.beginPath();
  ctx.moveTo(plot.left, plot.top);
  ctx.lineTo(plot.left, plot.top + plot.height);
  ctx.lineTo(plot.left + plot.width, plot.top + plot.height);
  ctx.stroke();

  ctx.fillStyle = "#64748B";
  ctx.font = "11px Segoe UI";
  for (let index = 0; index <= 4; index += 1) {
    const value = Math.round(maxValue - (maxValue / 4) * index);
    const y = plot.top + (plot.height / 4) * index;
    ctx.fillText(value.toLocaleString(), 12, y + 4);
  }

  const pointWidth = plot.width / Math.max(1, normalized.length);

  if (chart.type === "line") {
    ctx.strokeStyle = "#0F4C81";
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    normalized.forEach((point, index) => {
      const x = plot.left + pointWidth * index + pointWidth / 2;
      const y = plot.top + plot.height - (point.value / maxValue) * plot.height;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    normalized.forEach((point, index) => {
      const x = plot.left + pointWidth * index + pointWidth / 2;
      const y = plot.top + plot.height - (point.value / maxValue) * plot.height;
      ctx.fillStyle = point.color ?? "#0F4C81";
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
      ctx.fill();
    });
  } else {
    normalized.forEach((point, index) => {
      const barWidth = Math.max(10, pointWidth * 0.62);
      const x = plot.left + pointWidth * index + (pointWidth - barWidth) / 2;
      const barHeight = (point.value / maxValue) * plot.height;
      const y = plot.top + plot.height - barHeight;

      ctx.fillStyle = point.color ?? "#0F4C81";
      ctx.fillRect(x, y, barWidth, barHeight);
    });
  }

  ctx.fillStyle = "#334155";
  ctx.font = "11px Segoe UI";
  normalized.forEach((point, index) => {
    const label = point.label.length > 12 ? `${point.label.slice(0, 12)}...` : point.label;
    const x = plot.left + pointWidth * index + pointWidth / 2;
    ctx.save();
    ctx.translate(x, plot.top + plot.height + 16);
    ctx.rotate(-Math.PI / 7.5);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });

  return canvas.toDataURL("image/png").split(",")[1];
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

export function addThemedChartsSheet(
  workbook: ExcelJS.Workbook,
  options: ChartsSheetOptions
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(options.sheetName ?? "Charts");
  worksheet.columns = Array.from({ length: 12 }, () => ({ width: 14 }));

  worksheet.mergeCells("A1:L1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = options.title;
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_ARGB } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  worksheet.getRow(1).height = 24;

  if (options.subtitle) {
    worksheet.mergeCells("A2:L2");
    const subtitleCell = worksheet.getCell("A2");
    subtitleCell.value = options.subtitle;
    subtitleCell.font = { italic: true, color: { argb: "FF64748B" } };
  }

  const primaryImage = chartDataToBase64(options.primaryChart, 980, 320);
  if (primaryImage) {
    const primaryImageId = workbook.addImage({
      base64: primaryImage,
      extension: "png",
    });

    worksheet.addImage(primaryImageId, {
      tl: { col: 0.2, row: 3.2 },
      ext: { width: 980, height: 320 },
    });
  } else {
    worksheet.getCell("A5").value = "Charts are available only in browser export mode.";
    worksheet.getCell("A5").font = { color: { argb: "FF64748B" } };
    return worksheet;
  }

  if (options.secondaryChart) {
    const secondaryImage = chartDataToBase64(options.secondaryChart, 980, 320);
    if (secondaryImage) {
      const secondaryImageId = workbook.addImage({
        base64: secondaryImage,
        extension: "png",
      });

      worksheet.addImage(secondaryImageId, {
        tl: { col: 0.2, row: 22.2 },
        ext: { width: 980, height: 320 },
      });
    }
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
