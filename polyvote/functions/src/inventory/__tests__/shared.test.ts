import { describe, it, expect } from "vitest";
import {
  extractEanCodes,
  validateFieldSchema,
  validateItemFields,
  type FieldDef,
} from "../shared";
import { coreFieldSchema } from "../platforms";

describe("validateFieldSchema", () => {
  it("accepts the canonical core schema", () => {
    const schema = validateFieldSchema(coreFieldSchema());
    expect(schema.length).toBeGreaterThanOrEqual(6);
    expect(schema.map((f) => f.key)).toContain("title");
    expect(schema.map((f) => f.key)).toContain("price");
  });

  it("keeps only known platform ids in `platforms`", () => {
    const schema = validateFieldSchema([
      {
        key: "x",
        label: "X",
        type: "text",
        required: false,
        platforms: ["ebay", "bogus", "amazon"],
        order: 0,
      },
    ]);
    expect(schema[0].platforms).toEqual(["ebay", "amazon"]);
  });

  it("rejects duplicate keys", () => {
    expect(() =>
      validateFieldSchema([
        { key: "x", label: "X", type: "text", required: false, platforms: [], order: 0 },
        { key: "x", label: "X2", type: "text", required: false, platforms: [], order: 1 },
      ])
    ).toThrow(/duplicate/);
  });

  it("rejects invalid key shapes", () => {
    expect(() =>
      validateFieldSchema([
        { key: "Bad-Key", label: "L", type: "text", required: false, platforms: [], order: 0 },
      ])
    ).toThrow(/key must match/);
  });

  it("requires options on select", () => {
    expect(() =>
      validateFieldSchema([
        { key: "x", label: "X", type: "select", required: false, platforms: [], order: 0 },
      ])
    ).toThrow(/select type requires/);
  });
});

describe("validateItemFields", () => {
  const schema = coreFieldSchema();

  it("enforces required fields when asked", () => {
    const required = schema.map((f) =>
      f.key === "title" ? { ...f, required: true } : f
    );
    expect(() =>
      validateItemFields({ description: "x" }, required, { enforceRequired: true })
    ).toThrow(/required/);
  });

  it("allows missing required fields during dry-run import", () => {
    const out = validateItemFields(
      { title: "Hello" },
      schema,
      { enforceRequired: false }
    );
    expect(out.title).toBe("Hello");
    expect(out.price).toBeNull();
  });

  it("coerces numbers from strings", () => {
    const out = validateItemFields(
      { title: "t", sku: "s", price: "19.99", quantity: "3" },
      schema,
      { enforceRequired: true }
    );
    expect(out.price).toBe(19.99);
    expect(out.quantity).toBe(3);
  });

  it("rejects non-numeric numbers", () => {
    expect(() =>
      validateItemFields(
        { title: "t", sku: "s", price: "abc", quantity: 1 },
        schema,
        { enforceRequired: true }
      )
    ).toThrow(/must be a number/);
  });

  it("validates select options", () => {
    expect(() =>
      validateItemFields(
        { title: "t", sku: "s", price: 1, quantity: 1, condition: "Refurbished" },
        schema,
        { enforceRequired: true }
      )
    ).toThrow(/not an allowed option/);
  });
});

describe("ean field type", () => {
  const eanSchema: FieldDef[] = [
    {
      key: "ean",
      label: "EAN",
      type: "ean",
      required: false,
      platforms: [],
      order: 0,
    },
  ];

  it.each([
    ["EAN-8", "12345678"],
    ["UPC-A (12)", "012345678901"],
    ["EAN-13", "4006381333931"],
    ["GTIN-14", "10012345678902"],
  ])("accepts %s", (_label, code) => {
    const out = validateItemFields({ ean: code }, eanSchema, {
      enforceRequired: false,
    });
    expect(out.ean).toBe(code);
  });

  it("strips embedded whitespace before validating", () => {
    const out = validateItemFields(
      { ean: "  4006 38133 3931 " },
      eanSchema,
      { enforceRequired: false }
    );
    expect(out.ean).toBe("4006381333931");
  });

  it("rejects letters", () => {
    expect(() =>
      validateItemFields({ ean: "400638ABC3931" }, eanSchema, {
        enforceRequired: false,
      })
    ).toThrow(/must be an 8, 12, 13, or 14-digit barcode/);
  });

  it("rejects wrong digit counts", () => {
    expect(() =>
      validateItemFields({ ean: "12345" }, eanSchema, {
        enforceRequired: false,
      })
    ).toThrow(/must be an 8, 12, 13, or 14-digit barcode/);
    expect(() =>
      validateItemFields({ ean: "123456789012345" }, eanSchema, {
        enforceRequired: false,
      })
    ).toThrow(/must be an 8, 12, 13, or 14-digit barcode/);
  });
});

describe("extractEanCodes", () => {
  const schema: FieldDef[] = [
    { key: "title", label: "Title", type: "text", required: false, platforms: [], order: 0 },
    { key: "primary_ean", label: "EAN", type: "ean", required: false, platforms: [], order: 1 },
    { key: "alt_ean", label: "Alt EAN", type: "ean", required: false, platforms: [], order: 2 },
  ];

  it("returns every populated ean-typed value", () => {
    const codes = extractEanCodes(
      { title: "Camera", primary_ean: "4006381333931", alt_ean: "12345678" },
      schema
    );
    expect(codes).toEqual(["4006381333931", "12345678"]);
  });

  it("skips empty/blank ean fields", () => {
    const codes = extractEanCodes(
      { primary_ean: "4006381333931", alt_ean: "   " },
      schema
    );
    expect(codes).toEqual(["4006381333931"]);
  });

  it("ignores non-ean fields with numeric values", () => {
    const codes = extractEanCodes(
      { title: "1234567812345", primary_ean: null, alt_ean: null },
      schema
    );
    expect(codes).toEqual([]);
  });

  it("returns empty array when no ean fields exist in schema", () => {
    const noEanSchema = schema.filter((f) => f.type !== "ean");
    const codes = extractEanCodes({ title: "x" }, noEanSchema);
    expect(codes).toEqual([]);
  });
});
