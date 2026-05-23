import { describe, it, expect } from "vitest";
import { escapeXml, serializeXml } from "../xml";

describe("escapeXml", () => {
  it("escapes the five XML entities", () => {
    expect(escapeXml(`a & b < c > "d" 'e'`)).toBe(
      "a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;"
    );
  });
  it("renders empty for null/undefined", () => {
    expect(escapeXml(null)).toBe("");
    expect(escapeXml(undefined)).toBe("");
  });
});

describe("serializeXml", () => {
  const item = [
    { tag: "g:id", value: "SKU1" },
    { tag: "g:title", value: "Hello & Co" },
    { tag: "g:price", value: "9.99 EUR" },
  ];

  it("builds an RSS 2.0 feed with the Google namespace", () => {
    const out = serializeXml([item], "rss-google", { title: "Shop" });
    expect(out).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(out).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(out).toContain("<channel>");
    expect(out).toContain("<g:title>Hello &amp; Co</g:title>");
  });

  it("builds a generic <products> envelope for flat dialects", () => {
    const out = serializeXml([[{ tag: "name", value: "X" }]], "solute");
    expect(out).toContain("<products>");
    expect(out).toContain("<product>");
    expect(out).toContain("<name>X</name>");
  });

  it("builds a minimal OpenImmo skeleton", () => {
    const out = serializeXml(
      [
        [
          { tag: "title", value: "Flat" },
          { tag: "desc", value: "Nice" },
          { tag: "price", value: "1000" },
          { tag: "postalcode", value: "10115" },
        ],
      ],
      "openimmo"
    );
    expect(out).toContain("<openimmo>");
    expect(out).toContain("<objekttitel>Flat</objekttitel>");
    expect(out).toContain("<kaufpreis>1000</kaufpreis>");
    expect(out).toContain("<plz>10115</plz>");
  });

  it("omits empty fields", () => {
    const out = serializeXml([[{ tag: "g:brand", value: "" }]], "rss-google");
    expect(out).not.toContain("<g:brand>");
  });
});
