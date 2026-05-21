import { describe, it, expect } from "vitest";
import {
  defaultFieldSchema,
  missingEbayRequiredFields,
  validateFieldSchema,
  validateItemFields,
} from "../shared";

describe("validateFieldSchema", () => {
  it("accepts the default schema", () => {
    const schema = validateFieldSchema(defaultFieldSchema());
    expect(schema.length).toBeGreaterThanOrEqual(6);
    expect(schema.map((f) => f.key)).toContain("title");
    expect(schema.map((f) => f.key)).toContain("price");
  });

  it("rejects duplicate keys", () => {
    expect(() =>
      validateFieldSchema([
        { key: "x", label: "X", type: "text", required: false, ebayRequired: false, order: 0 },
        { key: "x", label: "X2", type: "text", required: false, ebayRequired: false, order: 1 },
      ])
    ).toThrow(/duplicate/);
  });

  it("rejects invalid key shapes", () => {
    expect(() =>
      validateFieldSchema([
        { key: "Bad-Key", label: "L", type: "text", required: false, ebayRequired: false, order: 0 },
      ])
    ).toThrow(/key must match/);
  });

  it("requires options on select", () => {
    expect(() =>
      validateFieldSchema([
        { key: "x", label: "X", type: "select", required: false, ebayRequired: false, order: 0 },
      ])
    ).toThrow(/select type requires/);
  });
});

describe("validateItemFields", () => {
  const schema = defaultFieldSchema();

  it("enforces required fields when asked", () => {
    expect(() =>
      validateItemFields({ description: "x" }, schema, { enforceRequired: true })
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
  const eanSchema = [
    {
      key: "ean",
      label: "EAN",
      type: "ean" as const,
      required: false,
      ebayRequired: false,
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

describe("missingEbayRequiredFields", () => {
  const schema = defaultFieldSchema();

  it("returns empty when all required fields are present", () => {
    const missing = missingEbayRequiredFields(
      { title: "T", description: "D", sku: "S", price: 1, quantity: 1, condition: "New" },
      schema
    );
    expect(missing).toEqual([]);
  });

  it("flags missing eBay-required fields by label", () => {
    const missing = missingEbayRequiredFields({ title: "T" }, schema);
    expect(missing).toContain("Description");
    expect(missing).toContain("Price");
    expect(missing).not.toContain("SKU"); // ebayRequired: false on SKU
  });

  it("treats blank strings as missing", () => {
    const missing = missingEbayRequiredFields(
      { title: "  " },
      schema
    );
    expect(missing).toContain("Title");
  });
});
