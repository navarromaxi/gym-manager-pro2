type UnknownRecord = Record<string, unknown>;

type InvoiceLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  surcharge: number;
  subtotal: number;
  total: number;
  taxIndicator?: string | null;
  unit?: string | null;
};

type InvoiceForPdf = {
  id: string;
  gym_id?: string | null;
  member_name?: string | null;
  total?: number | string | null;
  currency?: string | null;
  invoice_number?: string | null;
  invoice_series?: string | null;
  external_invoice_id?: string | null;
  environment?: string | null;
  typecfe?: number | null;
  issued_at?: string | null;
  due_date?: string | null;
  request_payload?: UnknownRecord | null;
  response_payload?: unknown;
};

type GymForPdf = {
  id: string;
  name?: string | null;
  invoice_rutneg?: string | null;
  invoice_dirneg?: string | null;
  invoice_cityneg?: string | null;
  invoice_stateneg?: string | null;
  invoice_addinfoneg?: string | null;
};

type ManualInvoicePdfOptions = {
  invoice: InvoiceForPdf;
  gym?: GymForPdf | null;
};

type PdfPage = {
  contents: string[];
  cursorY: number;
};

type TextFont = "regular" | "bold";

type TextBlockOptions = {
  x?: number;
  size?: number;
  font?: TextFont;
  lineHeight?: number;
  maxWidth?: number;
  afterGap?: number;
};

type NumberFormatOptions = {
  currency?: string | null;
};

type KeyValueRow = {
  label: string;
  value: string;
  size?: number;
  labelSize?: number;
  valueSize?: number;
  labelFont?: TextFont;
  valueFont?: TextFont;
};

type TableColumnDefinition = {
  title: string;
  width: number;
  align?: "left" | "center" | "right";
  size?: number;
};

const renderTableCell = (
  page: PdfPage,
  columns: TableColumnDefinition[],
  columnStarts: number[],
  columnIndex: number,
  topY: number,
  padding: number,
  lines: string[],
  options: { font?: TextFont; size?: number; align?: "left" | "center" | "right" } = {}
) => {
  const column = columns[columnIndex];
  const size = options.size ?? column.size ?? 10;
  const font = options.font ?? "regular";
  const align = options.align ?? column.align ?? "left";
  const columnStart = columnStarts[columnIndex];
  const columnWidth = column.width;
  const columnEnd = columnStart + columnWidth;

  const effectiveLines = lines.length > 0 ? lines : [" "];
  let textY = topY - padding - size;

  effectiveLines.forEach((line) => {
    let textX = columnStart + padding;
    if (align === "right") {
      const estimated = estimateTextWidth(line, size);
      textX = columnEnd - padding - estimated;
      if (textX < columnStart + padding) {
        textX = columnStart + padding;
      }
    } else if (align === "center") {
      const estimated = estimateTextWidth(line, size);
      textX = columnStart + columnWidth / 2 - estimated / 2;
    }

    writeText(page, line, textX, textY, size, font);
    textY -= size + 2;
  });
};

const PAGE_WIDTH = 595.28; // A4 width in points
const PAGE_HEIGHT = 841.89; // A4 height in points
const PAGE_MARGIN = 48;

const sanitizeString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return null;
};

const parseNumber = (value: unknown): number => {
  const stringValue = sanitizeString(value);
  if (!stringValue) return 0;

  let normalized = stringValue.replace(/\s+/g, "");
  if (normalized.includes(",") && !normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const wrapText = (text: string, maxWidth: number, size: number) => {
  const maxChars = Math.max(1, Math.floor(maxWidth / (size * 0.55)));
  const lines: string[] = [];

  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n/);

  normalized.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      return;
    }

    let currentLine = "";

    words.forEach((word) => {
      if (!currentLine) {
        currentLine = word;
        return;
      }

      const candidate = `${currentLine} ${word}`;
      if (candidate.length <= maxChars) {
        currentLine = candidate;
        return;
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      if (word.length <= maxChars) {
        currentLine = word;
        return;
      }

      let start = 0;
      while (start < word.length) {
        const end = Math.min(start + maxChars, word.length);
        lines.push(word.slice(start, end));
        start = end;
      }
      currentLine = "";
    });

    if (currentLine) {
      lines.push(currentLine);
    }
  });

  return lines;
};

const escapePdfString = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const createPage = (): PdfPage => ({
  contents: [],
  cursorY: PAGE_HEIGHT - PAGE_MARGIN,
});

const addNewPage = (pages: PdfPage[]) => {
  const page = createPage();
  pages.push(page);
  return page;
};

const ensureSpace = (page: PdfPage, pages: PdfPage[], height: number) => {
  if (page.cursorY - height < PAGE_MARGIN) {
    return addNewPage(pages);
  }
  return page;
};

const writeText = (
  page: PdfPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: TextFont
) => {
  const fontName = font === "bold" ? "F2" : "F1";
  const sizeValue = size.toFixed(2);
  const xValue = x.toFixed(2);
  const yValue = y.toFixed(2);
  const escaped = escapePdfString(text);

  page.contents.push("BT");
  page.contents.push(`/${fontName} ${sizeValue} Tf`);
  page.contents.push(`1 0 0 1 ${xValue} ${yValue} Tm`);
  page.contents.push(`(${escaped}) Tj`);
  page.contents.push("ET");
};

const estimateTextWidth = (text: string, size: number) => {
  if (!text) return 0;
  return text.length * size * 0.5;
};

const drawHorizontalLine = (page: PdfPage, x1: number, x2: number, y: number) => {
  page.contents.push(`${x1.toFixed(2)} ${y.toFixed(2)} m`);
  page.contents.push(`${x2.toFixed(2)} ${y.toFixed(2)} l`);
  page.contents.push("S");
};

const drawVerticalLine = (
  page: PdfPage,
  x: number,
  yTop: number,
  yBottom: number
) => {
  page.contents.push(`${x.toFixed(2)} ${yTop.toFixed(2)} m`);
  page.contents.push(`${x.toFixed(2)} ${yBottom.toFixed(2)} l`);
  page.contents.push("S");
};

const drawRectangle = (
  page: PdfPage,
  x: number,
  yTop: number,
  width: number,
  height: number
) => {
  const yBottom = yTop - height;
  drawHorizontalLine(page, x, x + width, yTop);
  drawHorizontalLine(page, x, x + width, yBottom);
  drawVerticalLine(page, x, yTop, yBottom);
  drawVerticalLine(page, x + width, yTop, yBottom);
};

const renderTwoColumnTable = (
  page: PdfPage,
  pages: PdfPage[],
  rows: KeyValueRow[],
  options: {
    title?: string;
    gapAfter?: number;
    labelWidth?: number;
    valueWidth?: number;
    fontSize?: number;
    headerSize?: number;
  } = {}
) => {
  if (!options.title && rows.length === 0) {
    return page;
  }

  const fontSize = options.fontSize ?? 10;
  const headerSize = options.headerSize ?? 12;
  const labelWidth = options.labelWidth ?? 160;
  const valueWidth = options.valueWidth ?? PAGE_WIDTH - 2 * PAGE_MARGIN - labelWidth;
  const tableWidth = labelWidth + valueWidth;
  const cellPadding = 6;
  const headerHeight = options.title ? headerSize + cellPadding * 2 : 0;

  const rowHeights = rows.map((row) => {
    const labelFontSize = row.labelSize ?? row.size ?? fontSize;
    const valueFontSize = row.valueSize ?? row.size ?? fontSize;
    const labelLines = wrapText(
      row.label,
      Math.max(1, labelWidth - cellPadding * 2),
      labelFontSize
    );
    const valueLines = wrapText(
      row.value,
      Math.max(1, valueWidth - cellPadding * 2),
      valueFontSize
    );
    const labelCount = labelLines.length > 0 ? labelLines.length : 1;
    const valueCount = valueLines.length > 0 ? valueLines.length : 1;
    const labelHeight =
      labelCount * (labelFontSize + 2) - 2 + cellPadding * 2;
    const valueHeight =
      valueCount * (valueFontSize + 2) - 2 + cellPadding * 2;
    return Math.max(20, labelHeight, valueHeight);
  });

  const totalHeight =
    headerHeight + rowHeights.reduce((sum, height) => sum + height, 0);
  if (totalHeight <= 0) {
    return page;
  }

  let currentPage = ensureSpace(page, pages, totalHeight);
  const startY = currentPage.cursorY;
  const startX = PAGE_MARGIN;

  currentPage.contents.push("0.5 w");
  drawRectangle(currentPage, startX, startY, tableWidth, totalHeight);

  const dividerX = startX + labelWidth;
  drawVerticalLine(currentPage, dividerX, startY, startY - totalHeight);

  let cursorY = startY;

  if (options.title) {
    const headerBottom = cursorY - headerHeight;
    drawHorizontalLine(currentPage, startX, startX + tableWidth, headerBottom);
    const titleY = cursorY - cellPadding - headerSize + 2;
    writeText(currentPage, options.title, startX + cellPadding, titleY, headerSize, "bold");
    cursorY = headerBottom;
  }

  rows.forEach((row, index) => {
    const rowHeight = rowHeights[index];
    const rowTop = cursorY;
    const rowBottom = rowTop - rowHeight;

    drawHorizontalLine(currentPage, startX, startX + tableWidth, rowBottom);

    const labelFontSize = row.labelSize ?? row.size ?? fontSize;
    const valueFontSize = row.valueSize ?? row.size ?? fontSize;
    const labelLines = wrapText(
      row.label,
      Math.max(1, labelWidth - cellPadding * 2),
      labelFontSize
    );
    const valueLines = wrapText(
      row.value,
      Math.max(1, valueWidth - cellPadding * 2),
      valueFontSize
    );

    let labelY = rowTop - cellPadding - labelFontSize;
    labelLines.forEach((line) => {
      writeText(
        currentPage,
        line,
        startX + cellPadding,
        labelY,
        labelFontSize,
        row.labelFont ?? "bold"
      );
      labelY -= labelFontSize + 2;
    });

    let valueY = rowTop - cellPadding - valueFontSize;
    valueLines.forEach((line) => {
      writeText(
        currentPage,
        line,
        dividerX + cellPadding,
        valueY,
        valueFontSize,
        row.valueFont ?? "regular"
      );
      valueY -= valueFontSize + 2;
    });

    cursorY = rowBottom;
  });

  currentPage.contents.push("1 w");

  currentPage.cursorY = startY - totalHeight;
  const gapAfter = options.gapAfter ?? 12;
  if (gapAfter > 0) {
    currentPage = addGap(currentPage, pages, gapAfter);
  }

  return currentPage;
};

const addGap = (page: PdfPage, pages: PdfPage[], gap: number) => {
  const next = ensureSpace(page, pages, gap);
  next.cursorY -= gap;
  return next;
};

const addTextBlock = (
  page: PdfPage,
  pages: PdfPage[],
  text: string,
  options: TextBlockOptions = {}
) => {
  const x = options.x ?? PAGE_MARGIN;
  const size = options.size ?? 12;
  const font = options.font ?? "regular";
  const lineHeight = options.lineHeight ?? size + 4;
  const maxWidth = options.maxWidth ?? PAGE_WIDTH - x - PAGE_MARGIN;
  const lines = wrapText(text, maxWidth, size);
  const requiredHeight = lines.length * lineHeight;

  let currentPage = ensureSpace(page, pages, requiredHeight);
  lines.forEach((line, index) => {
    const y = currentPage.cursorY - index * lineHeight;
    writeText(currentPage, line, x, y, size, font);
  });
  currentPage.cursorY -= requiredHeight;

  if (options.afterGap && options.afterGap > 0) {
    currentPage = addGap(currentPage, pages, options.afterGap);
  }

  return currentPage;
};

const addSeparator = (
  page: PdfPage,
  pages: PdfPage[],
  options: { gapBefore?: number; gapAfter?: number } = {}
) => {
  const gapBefore = options.gapBefore ?? 8;
  const gapAfter = options.gapAfter ?? 8;
  let currentPage = addGap(page, pages, gapBefore);
  const y = currentPage.cursorY;
  const startX = PAGE_MARGIN;
  const endX = PAGE_WIDTH - PAGE_MARGIN;

  currentPage.contents.push("0.80 G");
  currentPage.contents.push("0.5 w");
  currentPage.contents.push(`${startX.toFixed(2)} ${y.toFixed(2)} m`);
  currentPage.contents.push(`${endX.toFixed(2)} ${y.toFixed(2)} l`);
  currentPage.contents.push("S");
  currentPage.contents.push("0 G");
  currentPage.contents.push("1 w");

  currentPage = addGap(currentPage, pages, gapAfter);
  return currentPage;
};

const aggregateLines = (lines: InvoiceLineItem[]) => {
  return lines.reduce(
    (acc, line) => {
      return {
        subtotal: acc.subtotal + line.subtotal,
        discount: acc.discount + line.discount,
        surcharge: acc.surcharge + line.surcharge,
        total: acc.total + line.total,
      };
    },
    { subtotal: 0, discount: 0, surcharge: 0, total: 0 }
  );
};

const formatNumber = (value: number) => {
  try {
    return new Intl.NumberFormat("es-UY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (error) {
    return value.toFixed(2);
  }
};

const formatCurrency = (value: number, options: NumberFormatOptions = {}) => {
  const currency = sanitizeString(options.currency) ?? "UYU";
  try {
    return new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (error) {
    return `${currency} ${value.toFixed(2)}`;
  }
};

const extractParsedPayload = (value: unknown): UnknownRecord | null => {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object"
        ? (parsed as UnknownRecord)
        : null;
    } catch (error) {
      return null;
    }
  }

  if (typeof value === "object") {
    if (
      "parsed" in (value as UnknownRecord) &&
      (value as UnknownRecord).parsed &&
      typeof (value as UnknownRecord).parsed === "object"
    ) {
      return (value as UnknownRecord).parsed as UnknownRecord;
    }
    return value as UnknownRecord;
  }

  return null;
};

const findValueByKeyHints = (
  payload: unknown,
  hintGroups: string[][]
): string | null => {
  if (!payload || typeof payload !== "object") return null;

  const stack: UnknownRecord[] = [payload as UnknownRecord];
  const seen = new WeakSet<object>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (seen.has(current)) continue;
    seen.add(current);

    for (const [key, value] of Object.entries(current)) {
      const normalizedKey = key.toLowerCase();
      const matches = hintGroups.some((group) =>
        group.every((hint) => normalizedKey.includes(hint))
      );

      if (matches) {
        const candidate = sanitizeString(value);
        if (candidate) return candidate;
      }

      if (value && typeof value === "object") {
        stack.push(value as UnknownRecord);
      }
    }
  }

  return null;
};

const splitInvoiceLines = (value: string) => {
  const segments: string[] = [];
  let buffer = "";
  let columnCount = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (value.startsWith("</col/>", index)) {
      columnCount += 1;
      buffer += "</col/>";
      index += "</col/>".length - 1;
      continue;
    }

    const char = value[index];
    if (char === "," && columnCount >= 7) {
      const trimmed = buffer.trim();
      if (trimmed) {
        segments.push(trimmed);
      }
      buffer = "";
      columnCount = 0;
      continue;
    }

    buffer += char;
  }

  const trimmed = buffer.trim();
  if (trimmed) {
    segments.push(trimmed);
  }

  return segments;
};

const parseInvoiceLines = (value: unknown): InvoiceLineItem[] => {
  const raw = sanitizeString(value);
  if (!raw) return [];

  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return [];

  const segments = splitInvoiceLines(normalized);
  if (segments.length === 0) {
    const parts = normalized
      .split("</col/>")
      .map((part) => part.replace(/<\/?col\/?\>/gi, "").trim());
    if (parts.length >= 3) {
      segments.push(normalized);
    }
  }

  const items: InvoiceLineItem[] = [];

  segments.forEach((segment) => {
    const parts = segment
      .split("</col/>")
      .map((part) => part.replace(/<\/?col\/?\>/gi, "").trim());

    if (parts.length < 3) return;

    const quantity = parseNumber(parts[1]);
    const unitPrice = parseNumber(parts[2]);
    const discount = parseNumber(parts[3]);
    const surcharge = parseNumber(parts[4]);
    const description =
      sanitizeString(parts[5]) ?? sanitizeString(parts[0]) ?? "Ítem";
    const taxIndicator = sanitizeString(parts[6]);
    const unit = sanitizeString(parts[7]);
    const subtotal = quantity * unitPrice;
    const total = subtotal - discount + surcharge;

    const item: InvoiceLineItem = {
      description,
      quantity,
      unitPrice,
      discount,
      surcharge,
      subtotal,
      total,
    };

    if (taxIndicator !== null) {
      item.taxIndicator = taxIndicator;
    }

    if (unit !== null) {
      item.unit = unit;
    }

    items.push(item);
  });

  return items;
};

const buildPdfBuffer = (
  pages: PdfPage[],
  catalogId: number,
  pagesId: number,
  fontRegularId: number,
  fontBoldId: number,
  pageObjectIds: number[],
  contentObjectIds: number[]
) => {
  const objects: { id: number; content: string }[] = [];

  const pushObject = (id: number, content: string) => {
    objects.push({ id, content });
  };

  pushObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  pushObject(
    pagesId,
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] >>`
  );

  pushObject(fontRegularId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pushObject(
    fontBoldId,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  );

  pages.forEach((page, index) => {
    const contentString = `${page.contents.join("\n")}\n`;
    const contentLength = Buffer.byteLength(contentString, "utf8");
    const contentId = contentObjectIds[index];
    const pageId = pageObjectIds[index];

    pushObject(
      contentId,
      `<< /Length ${contentLength} >>\nstream\n${contentString}endstream`
    );

    pushObject(
      pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(
        2
      )} ${PAGE_HEIGHT.toFixed(2)}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> >>`
    );
  });

  const sortedObjects = objects.sort((a, b) => a.id - b.id);
  const pdfHeader = "%PDF-1.4\n";
  const buffers: Buffer[] = [Buffer.from(pdfHeader, "utf8")];
  const xrefEntries: string[] = ["0000000000 65535 f \n"];
  let offset = Buffer.byteLength(pdfHeader, "utf8");

  sortedObjects.forEach((object) => {
    const objectString = `${object.id} 0 obj\n${object.content}\nendobj\n`;
    const buffer = Buffer.from(objectString, "utf8");
    buffers.push(buffer);
    xrefEntries[object.id] = `${offset
      .toString()
      .padStart(10, "0")} 00000 n \n`;
    offset += buffer.length;
  });

  const xrefOffset = offset;
  const size = Math.max(...sortedObjects.map((object) => object.id)) + 1;
  const xrefHeader = `xref\n0 ${size}\n`;
  const xrefBody = Array.from({ length: size }, (_, index) =>
    xrefEntries[index] ?? "0000000000 00000 f \n"
  ).join("");

  buffers.push(Buffer.from(xrefHeader + xrefBody, "utf8"));

  const trailer = `trailer\n<< /Size ${size} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  buffers.push(Buffer.from(trailer, "utf8"));

  return Buffer.concat(buffers);
};

const resolveDateValue = (...values: unknown[]): string | null => {
  for (const value of values) {
    const candidate = sanitizeString(value);
    if (!candidate) continue;

    const isoMatch = candidate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const altMatch = candidate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (altMatch) {
      return `${altMatch[1]}/${altMatch[2]}/${altMatch[3]}`;
    }

    return candidate;
  }
  return null;
};

const describeTypecfe = (value: number | null | undefined): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "CFE";
  }

  switch (value) {
    case 101:
      return "e-Ticket";
    case 102:
      return "Nota de crédito e-Factura";
    case 103:
      return "Nota de débito e-Factura";
    case 111:
      return "e-Factura";
    case 112:
      return "Nota de crédito e-Ticket";
    case 113:
      return "Nota de débito e-Ticket";
    default:
      return `CFE ${value}`;
  }
};

const resolveTaxRate = (indicator: string | null | undefined): number | null => {
  if (!indicator) return null;
  const normalized = indicator.trim().toLowerCase();
  if (!normalized) return null;

  const percentMatch = normalized.match(/(\d{1,2})(?:[.,](\d+))?\s*%/);
  if (percentMatch) {
    const integerPart = Number(percentMatch[1]);
    if (Number.isFinite(integerPart)) {
      return integerPart;
    }
  }

  if (normalized.includes("bás") || normalized.includes("bas")) {
    return 22;
  }
  if (normalized.includes("mín") || normalized.includes("min")) {
    return 10;
  }
  if (normalized.includes("22")) {
    return 22;
  }
  if (normalized.includes("10")) {
    return 10;
  }
  if (
    normalized.includes("0%") ||
    normalized.includes("exent") ||
    normalized.includes("no grav") ||
    normalized.includes("exon")
  ) {
    return 0;
  }

  return null;
};

type TaxSummary = {
  label: string;
  rate: number | null;
  base: number;
  total: number;
  taxAmount: number;
};

const buildTaxSummaries = (lines: InvoiceLineItem[]): TaxSummary[] => {
  const summaryMap = new Map<string, TaxSummary>();

  lines.forEach((line) => {
    const key = line.taxIndicator ?? "Sin indicador";
    const existing = summaryMap.get(key);
    const rate = existing?.rate ?? resolveTaxRate(line.taxIndicator);
    const base = line.subtotal;
    const total = line.total;
    const taxAmount = Math.max(0, total - base);

    if (existing) {
      existing.base += base;
      existing.total += total;
      existing.taxAmount += taxAmount;
      if (existing.rate === null && rate !== null) {
        existing.rate = rate;
      }
    } else {
      summaryMap.set(key, {
        label: key,
        rate,
        base,
        total,
        taxAmount,
      });
    }
  });

  const summaries = Array.from(summaryMap.values());
  summaries.forEach((summary) => {
    if (
      summary.taxAmount <= 0.01 &&
      summary.rate !== null &&
      summary.rate > 0 &&
      summary.base > 0
    ) {
      const expected = summary.base * (summary.rate / 100);
      if (Number.isFinite(expected) && expected > 0) {
        summary.taxAmount = expected;
      }
    }
  });

  return summaries;
};

const buildInvoiceLinesSection = (
  page: PdfPage,
  pages: PdfPage[],
  lines: InvoiceLineItem[],
  currency: string | null
) => {
  if (lines.length === 0) {
    return addTextBlock(page, pages, "No se encontraron ítems en el comprobante.", {
      size: 11,
      afterGap: 10,
    });
  }

   const columns: TableColumnDefinition[] = [
    { title: "#", width: 20, align: "center", size: 10 },
    { title: "IVA", width: 50, align: "center", size: 10 },
    { title: "Producto / Servicio", width: 190, align: "left", size: 10 },
    { title: "Cant.", width: 46, align: "right", size: 10 },
    { title: "Precio Unit.", width: 62, align: "right", size: 10 },
    { title: "Monto", width: 60, align: "right", size: 10 },
    { title: "Monto IVA incl.", width: 70, align: "right", size: 10 },
  ];

  const startX = PAGE_MARGIN;
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const endX = startX + tableWidth;
  const cellPadding = 6;
  const headerHeight = 24;

  const columnStarts: number[] = [];
  let columnX = startX;
  columns.forEach((column) => {
    columnStarts.push(columnX);
    columnX += column.width;
  });

  let currentPage = page;
  let isFirstRow = true;

   const wrapForColumn = (text: string, column: TableColumnDefinition, size: number) =>
    wrapText(text, Math.max(1, column.width - cellPadding * 2), size);

    const drawRowLines = (topY: number, bottomY: number, drawTop: boolean) => {
    currentPage.contents.push("0.5 w");
    if (drawTop) {
      drawHorizontalLine(currentPage, startX, endX, topY);
    }
    drawHorizontalLine(currentPage, startX, endX, bottomY);
    drawVerticalLine(currentPage, startX, topY, bottomY);
    drawVerticalLine(currentPage, endX, topY, bottomY);
    for (let index = 1; index < columns.length; index += 1) {
      const x = columnStarts[index];
      drawVerticalLine(currentPage, x, topY, bottomY);
    }
    currentPage.contents.push("1 w");
  };

     const ensureSpaceForRow = (
    rowHeight: number,
    options: { skipHeader?: boolean } = {}
  ) => {
    if (currentPage.cursorY - rowHeight < PAGE_MARGIN) {
      currentPage = addNewPage(pages);
      isFirstRow = true;
      if (!options.skipHeader) {
        renderHeaderRow();
      }
    }
    };

    const renderHeaderRow = () => {
    ensureSpaceForRow(headerHeight, { skipHeader: true });
    const topY = currentPage.cursorY;
    const bottomY = topY - headerHeight;
    drawRowLines(topY, bottomY, true);
    columns.forEach((column, index) => {
      const size = column.size ?? 10;
      const lines = wrapForColumn(column.title, column, size);
      renderTableCell(currentPage, columns, columnStarts, index, topY, cellPadding, lines, {
        font: "bold",
        size,
      });
    });
    currentPage.cursorY = bottomY;
    isFirstRow = false;
  };

  renderHeaderRow();

  lines.forEach((line, index) => {
    const quantityText = formatNumber(line.quantity);
    const unitText = formatCurrency(line.unitPrice, { currency });
    const subtotalText = formatCurrency(line.subtotal, { currency });
    const totalText = formatCurrency(line.total, { currency });

    const descriptionParts: string[] = [];
    const description = line.description || "Ítem";
    descriptionParts.push(description);
    if (line.unit) {
      descriptionParts.push(`Unidad: ${line.unit}`);
    }
    if (line.discount) {
      descriptionParts.push(
        `Descuento: ${formatCurrency(line.discount, { currency })}`
      );
    }
     if (line.surcharge) {
      descriptionParts.push(
        `Recargo: ${formatCurrency(line.surcharge, { currency })}`
      );
    }

    const descriptionLines = descriptionParts.flatMap((part) =>
      wrapForColumn(part, columns[2], 10)
    );

    const rowHeight = Math.max(24, descriptionLines.length * (10 + 2) + cellPadding * 2);

    ensureSpaceForRow(rowHeight);
    const topY = currentPage.cursorY;
    const bottomY = topY - rowHeight;
    drawRowLines(topY, bottomY, isFirstRow);

    renderTableCell(
      currentPage,
      columns,
      columnStarts,
      0,
      topY,
      cellPadding,
      [String(index + 1)],
      { font: "bold", size: 10 }
    );
    renderTableCell(
      currentPage,
      columns,
      columnStarts,
      1,
      topY,
      cellPadding,
      line.taxIndicator ? wrapForColumn(line.taxIndicator, columns[1], 10) : ["-"],
      { size: 10 }
    );

    renderTableCell(
      currentPage,
      columns,
      columnStarts,
      2,
      topY,
      cellPadding,
      descriptionLines,
      { size: 10 }
    );

    const quantityLine = line.unit ? `${quantityText} ${line.unit}` : quantityText;
    renderTableCell(
      currentPage,
      columns,
      columnStarts,
      3,
      topY,
      cellPadding,
      [quantityLine],
      { size: 10, align: "right" }
    );

    renderTableCell(
      currentPage,
      columns,
      columnStarts,
      4,
      topY,
      cellPadding,
      [unitText],
      { size: 10, align: "right" }
    );

    renderTableCell(
      currentPage,
      columns,
      columnStarts,
      5,
      topY,
      cellPadding,
      [subtotalText],
      { size: 10, align: "right" }
    );

    renderTableCell(
      currentPage,
      columns,
      columnStarts,
      6,
      topY,
      cellPadding,
      [totalText],
      { size: 10, align: "right" }
    );

    currentPage.cursorY = bottomY;
    isFirstRow = false;
  });
  currentPage = addGap(currentPage, pages, 12);
  return currentPage;
};

export const buildManualInvoicePdf = async ({
  invoice,
  gym,
}: ManualInvoicePdfOptions): Promise<Uint8Array | null> => {
  if (!invoice) return null;

  const requestPayload = invoice.request_payload ?? {};
  const parsedResponse = extractParsedPayload(invoice.response_payload);

  const caeNumber =
    findValueByKeyHints(parsedResponse, [
      ["cae", "nro"],
      ["cae", "numero"],
      ["cae", "code"],
    ]) ??
    findValueByKeyHints(parsedResponse, [["cae"]]) ??
    sanitizeString(invoice.external_invoice_id) ??
    "Pendiente";

  let invoiceNumber =
    sanitizeString(invoice.invoice_number) ??
    findValueByKeyHints(parsedResponse, [
      ["numero", "cfe"],
      ["nro", "cfe"],
      ["numero", "comprobante"],
      ["nro", "comprobante"],
    ]) ??
    sanitizeString((requestPayload as UnknownRecord)?.numerocomprobante) ??
    sanitizeString((requestPayload as UnknownRecord)?.nrocomprobante);

  if (!invoiceNumber) {
    invoiceNumber =
      sanitizeString(invoice.external_invoice_id) ??
      sanitizeString((requestPayload as UnknownRecord)?.numero) ??
      invoice.id;
  }

  const caeExpiration = findValueByKeyHints(parsedResponse, [
    ["cae", "vto"],
    ["cae", "vence"],
    ["cae", "fechav"],
  ]);
  const caeId = findValueByKeyHints(parsedResponse, [
    ["cae", "id"],
    ["cae", "nro"],
  ]);
  const caeLink =
    findValueByKeyHints(parsedResponse, [["url"]]) ??
    findValueByKeyHints(parsedResponse, [["link"]]);

  const invoiceSeries =
    sanitizeString(invoice.invoice_series) ??
    sanitizeString((requestPayload as UnknownRecord)?.seriereferencia) ??
    findValueByKeyHints(parsedResponse, [["serie"]]);

  const currency =
    sanitizeString(invoice.currency) ??
    sanitizeString((requestPayload as UnknownRecord)?.moneda) ??
    "UYU";

  const issueDate = resolveDateValue(
    invoice.issued_at,
    (requestPayload as UnknownRecord)?.fechafacturacion,
    findValueByKeyHints(parsedResponse, [["fecha", "emision"]]) ??
      findValueByKeyHints(parsedResponse, [["fecha", "emisión"]]) ??
      findValueByKeyHints(parsedResponse, [["fecha", "cfe"]])
  );

  const dueDate = resolveDateValue(
    invoice.due_date,
    (requestPayload as UnknownRecord)?.fechavencimiento,
    findValueByKeyHints(parsedResponse, [["fecha", "venc"]])
  );

  const memberName =
    sanitizeString((requestPayload as UnknownRecord)?.nomneg) ??
    sanitizeString(invoice.member_name) ??
    "Cliente";

  const customerDocument =
    sanitizeString((requestPayload as UnknownRecord)?.rutneg) ??
    sanitizeString((requestPayload as UnknownRecord)?.documento) ??
    sanitizeString((requestPayload as UnknownRecord)?.cedula) ??
    null;

  const customerAddress = [
    sanitizeString((requestPayload as UnknownRecord)?.dirneg),
    sanitizeString((requestPayload as UnknownRecord)?.cityneg),
    sanitizeString((requestPayload as UnknownRecord)?.stateneg),
  ]
    .filter(Boolean)
    .join(", ");

  const additionalInfo = sanitizeString(
    (requestPayload as UnknownRecord)?.additionalinfo
  );
  const termsConditions = sanitizeString(
    (requestPayload as UnknownRecord)?.terms_conditions
  );
  const indicadorFacturacion = sanitizeString(
    (requestPayload as UnknownRecord)?.indicadorfacturacion
  );
  const reference = sanitizeString(
    (requestPayload as UnknownRecord)?.facturareferencia
  );
  const periodStart = resolveDateValue(
    (requestPayload as UnknownRecord)?.periododesde
  );
  const periodEnd = resolveDateValue(
    (requestPayload as UnknownRecord)?.periodohasta
  );

  const lineItems = parseInvoiceLines(
    (requestPayload as UnknownRecord)?.lineas
  );

  const aggregates = aggregateLines(lineItems);
  const resolvedTotalRaw =
    typeof invoice.total === "number"
      ? invoice.total
      : parseNumber(invoice.total);
  const invoiceTotal = Number.isFinite(resolvedTotalRaw)
    ? resolvedTotalRaw
    : aggregates.total;

  const gymName = sanitizeString(gym?.name) ?? "Gimnasio";
  const gymRut = sanitizeString(gym?.invoice_rutneg);
  const gymAddress = [
    sanitizeString(gym?.invoice_dirneg),
    sanitizeString(gym?.invoice_cityneg),
    sanitizeString(gym?.invoice_stateneg),
  ]
    .filter(Boolean)
    .join(", ");

  const gymAdditionalInfo = sanitizeString(gym?.invoice_addinfoneg);

  const environment = sanitizeString(invoice.environment);

  const resolvedTypecfe =
    typeof invoice.typecfe === "number" && Number.isFinite(invoice.typecfe)
      ? invoice.typecfe
      : parseNumber((requestPayload as UnknownRecord)?.typecfe);
  const typecfeDescription = describeTypecfe(
    Number.isFinite(resolvedTypecfe) && resolvedTypecfe !== 0
      ? resolvedTypecfe
      : null
  );

  const taxSummaries = buildTaxSummaries(lineItems);

  const pages: PdfPage[] = [createPage()];
  let currentPage = pages[0];

  const headingHeight = 54;
  if (currentPage.cursorY - headingHeight < PAGE_MARGIN) {
    currentPage = addNewPage(pages);
  }
  const headingTop = currentPage.cursorY;
  writeText(currentPage, gymName, PAGE_MARGIN, headingTop, 18, "bold");
  writeText(
    currentPage,
    "Factura electrónica",
    PAGE_MARGIN,
    headingTop - 20,
    14,
    "bold"
  );
  if (typecfeDescription) {
    writeText(
      currentPage,
      typecfeDescription,
      PAGE_MARGIN,
      headingTop - 38,
      11,
      "regular"
    );
  }
  currentPage.cursorY = headingTop - headingHeight;
  currentPage.contents.push("0.5 w");
  drawHorizontalLine(
    currentPage,
    PAGE_MARGIN,
    PAGE_WIDTH - PAGE_MARGIN,
    currentPage.cursorY + 10
  );
  currentPage.contents.push("1 w");
  currentPage.cursorY -= 14;

  const emitterRows: KeyValueRow[] = [
    {
      label: "RUT emisor",
      value: gymRut ?? "No informado",
    },
    {
      label: "Dirección",
      value: gymAddress || "No informado",
    },
  ];
  if (gymAdditionalInfo) {
    emitterRows.push({
      label: "Información adicional",
      value: gymAdditionalInfo,
    });
  }
  currentPage = renderTwoColumnTable(currentPage, pages, emitterRows, {
    title: "Datos del emisor",
  });

  const periodParts = [
    periodStart ? `Desde ${periodStart}` : null,
    periodEnd ? `Hasta ${periodEnd}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const invoiceRows: KeyValueRow[] = [
    { label: "Tipo de CFE", value: typecfeDescription },
    { label: "Serie", value: invoiceSeries ?? "-" },
    { label: "Número", value: `${invoiceNumber}` },
    { label: "Moneda", value: currency },
  ];

  if (issueDate) {
    invoiceRows.push({ label: "Fecha de emisión", value: issueDate });
  }

  if (dueDate) {
    invoiceRows.push({ label: "Fecha de vencimiento", value: dueDate });
  }
  if (reference) {
    invoiceRows.push({ label: "Referencia interna", value: reference });
  }

  if (indicadorFacturacion) {
    invoiceRows.push({
      label: "Indicador de facturación",
      value: indicadorFacturacion,
    });
  }

  if (environment) {
    invoiceRows.push({ label: "Ambiente", value: environment });
  }

  currentPage = renderTwoColumnTable(currentPage, pages, invoiceRows, {
    title: "Datos del comprobante",
  });

  const receptorRows: KeyValueRow[] = [
    { label: "Receptor", value: memberName },
    {
      label: "Documento",
      value: customerDocument ?? "Consumidor final",
    },
    {
      label: "Dirección",
      value: customerAddress || "No informado",
    },
  ];

  if (periodParts) {
    receptorRows.push({
      label: "Período de referencia",
      value: periodParts,
    });
  }

  currentPage = renderTwoColumnTable(currentPage, pages, receptorRows, {
    title: "Datos del receptor",
  });

  currentPage = buildInvoiceLinesSection(currentPage, pages, lineItems, currency);

  const totalsRows: KeyValueRow[] = [
    {
      label: "Subtotal",
      value: formatCurrency(aggregates.subtotal, { currency }),
    },
  ];

  if (aggregates.discount) {
    totalsRows.push({
      label: "Descuentos",
      value: formatCurrency(aggregates.discount, { currency }),
    });
  }
  if (aggregates.surcharge) {
    totalsRows.push({
      label: "Recargos",
      value: formatCurrency(aggregates.surcharge, { currency }),
    });
  }
   taxSummaries.forEach((summary) => {
    if (summary.rate === null) {
      totalsRows.push({
        label: `Total ${summary.label}`,
        value: formatCurrency(summary.total, { currency }),
      });
      return;
    }

    const rateLabel = `${summary.rate}%`;
    totalsRows.push({
      label: `Sub Total IVA ${rateLabel}`,
      value: formatCurrency(summary.base, { currency }),
    });
    if (summary.taxAmount > 0.01) {
      totalsRows.push({
        label: `IVA ${rateLabel}`,
        value: formatCurrency(summary.taxAmount, { currency }),
      });
    }
    totalsRows.push({
      label: `Monto total IVA ${rateLabel}`,
      value: formatCurrency(summary.base + summary.taxAmount, { currency }),
    });
  });

   totalsRows.push({
    label: "Total a pagar",
    value: formatCurrency(invoiceTotal, { currency }),
    size: 12,
    labelFont: "bold",
    valueFont: "bold",
  });

  currentPage = renderTwoColumnTable(currentPage, pages, totalsRows, {
    title: "Totales",
  });

  const caeRows: KeyValueRow[] = [
    { label: "CAE", value: caeNumber },
  ];
  if (caeId && caeId !== caeNumber) {
    caeRows.push({ label: "Identificador CAE", value: caeId })
  }
  if (caeExpiration) {
    caeRows.push({ label: "Vencimiento del CAE", value: caeExpiration });
  }
  if (caeLink) {
    caeRows.push({ label: "Enlace de verificación", value: caeLink });
  }

  currentPage = renderTwoColumnTable(currentPage, pages, caeRows, {
    title: "Datos de autorización (CAE)",
  });

  if (additionalInfo) {
    currentPage = renderTwoColumnTable(
      currentPage,
      pages,
       [
        {
          label: "Detalle",
          value: additionalInfo,
          labelFont: "bold",
        },
      ],
      {
        title: "Información adicional",
        labelWidth: 140,
      }
    );
  }

  if (termsConditions) {
    currentPage = renderTwoColumnTable(
      currentPage,
      pages,
      [
        {
          label: "Condiciones",
          value: termsConditions,
          labelFont: "bold",
        },
      ],
      {
        title: "Términos y condiciones",
        labelWidth: 160,
      }
    );
  }

  currentPage = addSeparator(currentPage, pages, { gapBefore: 10, gapAfter: 6 });
  currentPage = addTextBlock(
    currentPage,
    pages,
    "Documento generado automáticamente a partir de la respuesta de FacturaLive.",
    { size: 10 }
  );

  const catalogId = 1;
  const pagesId = 2;
  const fontRegularId = 3;
  const fontBoldId = 4;
  const contentObjectIds = pages.map((_, index) => 5 + index * 2);
  const pageObjectIds = pages.map((_, index) => 6 + index * 2);

  const buffer = buildPdfBuffer(
    pages,
    catalogId,
    pagesId,
    fontRegularId,
    fontBoldId,
    pageObjectIds,
    contentObjectIds
  );

  return new Uint8Array(buffer);
};