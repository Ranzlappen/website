/**
 * Tiny dependency-free XML serializer for platform feeds (mirrors the
 * no-deps approach of `csv.ts`). Each platform's `xmlTag` names drive the
 * element names; the dialect picks the envelope.
 */
import type { XmlDialect } from "./platforms";

export function escapeXml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface XmlField {
  tag: string;
  value: string | number;
}

const HEAD = '<?xml version="1.0" encoding="UTF-8"?>';

function elements(fields: XmlField[]): string {
  return fields
    .filter((f) => f.value !== "" && f.value !== null && f.value !== undefined)
    .map((f) => `    <${f.tag}>${escapeXml(f.value)}</${f.tag}>`)
    .join("\n");
}

function openImmoItem(fields: XmlField[]): string {
  const by = new Map(fields.map((f) => [f.tag, f.value]));
  const v = (t: string) => escapeXml(by.get(t) ?? "");
  return [
    "    <immobilie>",
    "      <freitexte>",
    `        <objekttitel>${v("title")}</objekttitel>`,
    `        <objektbeschreibung>${v("desc")}</objektbeschreibung>`,
    "      </freitexte>",
    `      <preise><kaufpreis>${v("price")}</kaufpreis></preise>`,
    `      <geo><plz>${v("postalcode")}</plz></geo>`,
    by.get("image")
      ? `      <anhaenge><anhang><daten><pfad>${v("image")}</pfad></daten></anhang></anhaenge>`
      : "",
    "    </immobilie>",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * `items` is one ordered field list per product. `dialect` selects the
 * envelope; `meta.title` labels the feed channel where relevant.
 */
export function serializeXml(
  items: XmlField[][],
  dialect: XmlDialect,
  meta: { title?: string } = {}
): string {
  if (dialect === "rss-google") {
    const body = items
      .map((f) => `  <item>\n${elements(f)}\n  </item>`)
      .join("\n");
    return [
      HEAD,
      '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
      "<channel>",
      `  <title>${escapeXml(meta.title ?? "Inventory")}</title>`,
      body,
      "</channel>",
      "</rss>",
      "",
    ].join("\n");
  }

  if (dialect === "openimmo") {
    const body = items.map(openImmoItem).join("\n");
    return [
      HEAD,
      "<openimmo>",
      "  <uebertragung art=\"OFFLINE\" umfang=\"VOLL\" modus=\"NEW\"/>",
      "  <anbieter>",
      body,
      "  </anbieter>",
      "</openimmo>",
      "",
    ].join("\n");
  }

  // solute / idealo / geizhals / flat → generic <products><product>.
  const body = items
    .map((f) => `  <product>\n${elements(f)}\n  </product>`)
    .join("\n");
  return [HEAD, "<products>", body, "</products>", ""].join("\n");
}
