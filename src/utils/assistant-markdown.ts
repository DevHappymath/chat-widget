// Escape hết rồi mới dựng thẻ: ghi chú lead do khách gõ không chèn được thẻ hay script vào trang.
// Không bao giờ dựng <img>: ảnh trỏ ra ngoài là đường rò dữ liệu qua URL.

/** Link chỉ được trỏ về các trang của công ty; link khác hiện thành chữ thường. */
const ALLOWED_LINK_HOSTS = ["giaoducthanhdat.vn", "gdtd.vn"];

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const unescapeHtml = (text: string) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

export const isAllowedAssistantLink = (href: string) => {
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    return ALLOWED_LINK_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
};

/** Nhận chuỗi đã escape. */
const renderInline = (escaped: string) => {
  // Tách code ra trước để dấu ** bên trong code không bị hiểu thành chữ đậm.
  const codes: string[] = [];
  let html = escaped.replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });

  html = html
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) =>
      isAllowedAssistantLink(unescapeHtml(href))
        ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : label,
    );

  return html.replace(/\u0000(\d+)\u0000/g, (_, index: string) => codes[Number(index)] ?? "");
};

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const UNORDERED_ITEM = /^\s*[-*•]\s+(.*)$/;
const ORDERED_ITEM = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

export const renderAssistantMarkdown = (source: string): string => {
  const lines = escapeHtml(source.replace(/\r\n?/g, "\n")).split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(`<p>${paragraph.map(renderInline).join("<br>")}</p>`);
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";

    if (line.trim().startsWith("```")) {
      flushParagraph();
      const code: string[] = [];
      index++;
      while (index < lines.length && !(lines[index] ?? "").trim().startsWith("```")) {
        code.push(lines[index] ?? "");
        index++;
      }
      blocks.push(`<pre><code>${code.join("\n")}</code></pre>`);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const next = lines[index + 1] ?? "";
    if (line.includes("|") && TABLE_SEPARATOR.test(next)) {
      flushParagraph();
      const head = splitRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && (lines[index] ?? "").includes("|")) {
        rows.push(splitRow(lines[index] ?? ""));
        index++;
      }
      index--;

      const thead = head.map((cell) => `<th>${renderInline(cell)}</th>`).join("");
      const tbody = rows
        .map((row) => `<tr>${head.map((_, i) => `<td>${renderInline(row[i] ?? "")}</td>`).join("")}</tr>`)
        .join("");
      blocks.push(`<div class="md-table"><table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`);
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push(`<p class="md-heading">${renderInline(heading[1] ?? "")}</p>`);
      continue;
    }

    const listPattern = UNORDERED_ITEM.test(line) ? UNORDERED_ITEM : ORDERED_ITEM.test(line) ? ORDERED_ITEM : null;
    if (listPattern) {
      flushParagraph();
      const tag = listPattern === UNORDERED_ITEM ? "ul" : "ol";
      const items: string[] = [];
      while (index < lines.length && listPattern.test(lines[index] ?? "")) {
        items.push(`<li>${renderInline(listPattern.exec(lines[index] ?? "")?.[1] ?? "")}</li>`);
        index++;
      }
      index--;
      blocks.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return blocks.join("");
};
