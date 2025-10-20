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

const buildInvoiceLinesSection = (
  page: PdfPage,
  pages: PdfPage[],
  lines: InvoiceLineItem[],
  currency: string | null
) => {
  if (lines.length === 0) {
    return addTextBlock(page, pages, "No se encontraron ítems en el comprobante.", {
      size: 11,
      afterGap: 6,
    });
  }

  let currentPage = page;

  lines.forEach((line, index) => {
    const title = `${index + 1}. ${line.description}`;
    currentPage = addTextBlock(currentPage, pages, title, {
      font: "bold",
      size: 11,
    });

    const quantityText = `Cantidad: ${formatNumber(line.quantity)}${
      line.unit ? ` ${line.unit}` : ""
    }`;
    const unitText = `Precio unitario: ${formatCurrency(line.unitPrice, {
      currency,
    })}`;
    const totalText = `Total de la línea: ${formatCurrency(line.total, {
      currency,
    })}`;
    currentPage = addTextBlock(
      currentPage,
      pages,
      `${quantityText} | ${unitText} | ${totalText}`,
      {
        size: 10,
      }
    );

    if (line.discount || line.surcharge) {
      const adjustments: string[] = [];
      if (line.discount) {
        adjustments.push(
          `Descuento: ${formatCurrency(line.discount, { currency })}`
        );
      }
      if (line.surcharge) {
        adjustments.push(
          `Recargo: ${formatCurrency(line.surcharge, { currency })}`
        );
      }
      currentPage = addTextBlock(currentPage, pages, adjustments.join(" | "), {
        size: 10,
      });
    }

    if (line.taxIndicator) {
      currentPage = addTextBlock(
        currentPage,
        pages,
        `Indicador tributario: ${line.taxIndicator}`,
        { size: 10 }
      );
    }

    currentPage = addGap(currentPage, pages, 6);
  });

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
    findValueByKeyHints(parsedResponse, [["cae"]]);

  const invoiceNumber =
    sanitizeString(invoice.invoice_number) ??
    findValueByKeyHints(parsedResponse, [
      ["numero", "cfe"],
      ["nro", "cfe"],
      ["numero", "comprobante"],
      ["nro", "comprobante"],
    ]);

  if (!caeNumber || !invoiceNumber) {
    return null;
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

  const pages: PdfPage[] = [createPage()];
  let currentPage = pages[0];

  currentPage = addTextBlock(currentPage, pages, "Factura electrónica", {
    font: "bold",
    size: 16,
  });
  currentPage = addTextBlock(currentPage, pages, gymName, {
    font: "bold",
    size: 14,
  });
  if (gymRut) {
    currentPage = addTextBlock(currentPage, pages, `RUT: ${gymRut}`, {
      size: 11,
    });
  }
  if (gymAddress) {
    currentPage = addTextBlock(currentPage, pages, gymAddress, {
      size: 11,
    });
  }
  if (gymAdditionalInfo) {
    currentPage = addTextBlock(currentPage, pages, gymAdditionalInfo, {
      size: 10,
    });
  }

  currentPage = addSeparator(currentPage, pages);

  currentPage = addTextBlock(currentPage, pages, "Datos del cliente", {
    font: "bold",
    size: 13,
  });
  currentPage = addTextBlock(currentPage, pages, `Nombre: ${memberName}`, {
    size: 11,
  });
  if (customerDocument) {
    currentPage = addTextBlock(
      currentPage,
      pages,
      `Documento: ${customerDocument}`,
      { size: 11 }
    );
  }
  if (customerAddress) {
    currentPage = addTextBlock(currentPage, pages, `Dirección: ${customerAddress}`, {
      size: 11,
    });
  }
  if (periodStart || periodEnd) {
    const periodParts = [
      periodStart ? `desde ${periodStart}` : null,
      periodEnd ? `hasta ${periodEnd}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    if (periodParts) {
      currentPage = addTextBlock(
        currentPage,
        pages,
        `Período de referencia: ${periodParts}`,
        { size: 11 }
      );
    }
  }

  currentPage = addSeparator(currentPage, pages);

  currentPage = addTextBlock(currentPage, pages, "Detalles de la factura", {
    font: "bold",
    size: 13,
  });

  const serieText = invoiceSeries ? `${invoiceSeries} - ` : "";
  currentPage = addTextBlock(
    currentPage,
    pages,
    `Número de factura: ${serieText}${invoiceNumber}`,
    { size: 11 }
  );

  if (reference) {
    currentPage = addTextBlock(currentPage, pages, `Referencia interna: ${reference}`, {
      size: 11,
    });
  }

  if (issueDate) {
    currentPage = addTextBlock(
      currentPage,
      pages,
      `Fecha de emisión: ${issueDate}`,
      { size: 11 }
    );
  }

  if (dueDate) {
    currentPage = addTextBlock(
      currentPage,
      pages,
      `Fecha de vencimiento: ${dueDate}`,
      { size: 11 }
    );
  }

  currentPage = addTextBlock(
    currentPage,
    pages,
    `Moneda: ${currency}`,
    { size: 11 }
  );

  if (indicadorFacturacion) {
    currentPage = addTextBlock(
      currentPage,
      pages,
      `Indicador de facturación: ${indicadorFacturacion}`,
      { size: 11 }
    );
  }

  const environment = sanitizeString(invoice.environment);
  if (environment) {
    currentPage = addTextBlock(
      currentPage,
      pages,
      `Ambiente: ${environment}`,
      { size: 11 }
    );
  }

  currentPage = addSeparator(currentPage, pages);

  currentPage = addTextBlock(currentPage, pages, "Detalle de ítems", {
    font: "bold",
    size: 13,
  });
  currentPage = buildInvoiceLinesSection(
    currentPage,
    pages,
    lineItems,
    currency
  );

  currentPage = addSeparator(currentPage, pages, { gapBefore: 4, gapAfter: 8 });

  currentPage = addTextBlock(currentPage, pages, "Totales", {
    font: "bold",
    size: 13,
  });
  currentPage = addTextBlock(
    currentPage,
    pages,
    `Subtotal: ${formatCurrency(aggregates.subtotal, { currency })}`,
    { size: 11 }
  );
  if (aggregates.discount) {
    currentPage = addTextBlock(
      currentPage,
      pages,
      `Descuentos: ${formatCurrency(aggregates.discount, { currency })}`,
      { size: 11 }
    );
  }
  if (aggregates.surcharge) {
    currentPage = addTextBlock(
      currentPage,
      pages,
      `Recargos: ${formatCurrency(aggregates.surcharge, { currency })}`,
      { size: 11 }
    );
  }
  currentPage = addTextBlock(
    currentPage,
    pages,
    `Total: ${formatCurrency(invoiceTotal, { currency })}`,
    { font: "bold", size: 12 }
  );

  currentPage = addSeparator(currentPage, pages, { gapBefore: 6, gapAfter: 8 });

  currentPage = addTextBlock(
    currentPage,
    pages,
    "Datos de autorización (CAE)",
    { font: "bold", size: 13 }
  );
  currentPage = addTextBlock(
    currentPage,
    pages,
    `CAE: ${caeNumber}`,
    { size: 11 }
  );
  if (caeId && caeId !== caeNumber) {
    currentPage = addTextBlock(currentPage, pages, `Identificador CAE: ${caeId}`, {
      size: 11,
    });
  }
  if (caeExpiration) {
    currentPage = addTextBlock(
      currentPage,
      pages,
      `Vencimiento del CAE: ${caeExpiration}`,
      { size: 11 }
    );
  }
  if (caeLink) {
    currentPage = addTextBlock(
      currentPage,
      pages,
      `Enlace de verificación: ${caeLink}`,
      { size: 10 }
    );
  }

  if (additionalInfo) {
    currentPage = addSeparator(currentPage, pages);
    currentPage = addTextBlock(
      currentPage,
      pages,
      "Información adicional",
      { font: "bold", size: 13 }
    );
    currentPage = addTextBlock(currentPage, pages, additionalInfo, {
      size: 11,
    });
  }

  if (termsConditions) {
    currentPage = addSeparator(currentPage, pages);
    currentPage = addTextBlock(
      currentPage,
      pages,
      "Términos y condiciones",
      { font: "bold", size: 13 }
    );
    currentPage = addTextBlock(currentPage, pages, termsConditions, {
      size: 11,
    });
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