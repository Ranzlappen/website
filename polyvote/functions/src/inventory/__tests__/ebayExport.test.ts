import { describe, it, expect } from "vitest";
import { buildEbayCsv } from "../ebayExport";
import {
  defaultEbayBlock,
  defaultFieldSchema,
  type FieldDef,
  type ItemDoc,
} from "../shared";
import { parseCsv } from "../csv";

function makeItem(overrides: Partial<ItemDoc> = {}): ItemDoc {
  return {
    folderId: "folder-1",
    fields: {
      title: "Test item",
      description: "A test",
      sku: "SKU-001",
      price: 19.99,
      quantity: 2,
      condition: "New",
    },
    photos: [
      {
        storagePath: "inventory/x/a.jpg",
        downloadUrl: "https://storage.googleapis.com/bucket/inventory/x/a.jpg",
        filename: "a.jpg",
        sizeBytes: 100,
        width: 800,
        height: 600,
        order: 0,
      },
      {
        storagePath: "inventory/x/b.jpg",
        downloadUrl: "https://storage.googleapis.com/bucket/inventory/x/b.jpg",
        filename: "b.jpg",
        sizeBytes: 100,
        width: 800,
        height: 600,
        order: 1,
      },
    ],
    ebay: defaultEbayBlock(),
    eanCodes: [],
    createdAt: 1,
    updatedAt: 1,
    createdBy: "u",
    deletedAt: null,
    ...overrides,
  };
}

describe("buildEbayCsv", () => {
  it("emits the expected core columns + Country/Currency", () => {
    const schema = defaultFieldSchema();
    const items = [{ id: "i1", data: makeItem() }];
    const { csv, columns } = buildEbayCsv(items, new Map([["folder-1", schema]]));

    expect(columns[0]).toBe("Action");
    expect(columns).toContain("Title");
    expect(columns).toContain("StartPrice");
    expect(columns).toContain("PicURL");
    expect(columns).toContain("Country");
    expect(columns).toContain("Currency");

    const parsed = parseCsv(csv);
    expect(parsed[0]).toEqual(columns);
    const titleIdx = columns.indexOf("Title");
    expect(parsed[1][titleIdx]).toBe("Test item");
    const priceIdx = columns.indexOf("StartPrice");
    expect(parsed[1][priceIdx]).toBe("19.99");
  });

  it("pipe-separates photo URLs in PicURL", () => {
    const schema = defaultFieldSchema();
    const items = [{ id: "i1", data: makeItem() }];
    const { csv, columns } = buildEbayCsv(items, new Map([["folder-1", schema]]));
    const parsed = parseCsv(csv);
    const idx = columns.indexOf("PicURL");
    expect(parsed[1][idx]).toBe(
      "https://storage.googleapis.com/bucket/inventory/x/a.jpg|https://storage.googleapis.com/bucket/inventory/x/b.jpg"
    );
  });

  it("uses Revise action when item already has a listingId", () => {
    const schema = defaultFieldSchema();
    const items = [
      {
        id: "i1",
        data: makeItem({
          ebay: { ...defaultEbayBlock(), listingId: "12345" },
        }),
      },
    ];
    const { csv, columns } = buildEbayCsv(items, new Map([["folder-1", schema]]));
    const parsed = parseCsv(csv);
    const idx = columns.indexOf("Action");
    expect(parsed[1][idx]).toBe("Revise");
  });

  it("emits custom item-specifics as C:<label> columns", () => {
    const customSchema: FieldDef[] = [
      ...defaultFieldSchema(),
      {
        key: "brand",
        label: "Brand",
        type: "text",
        required: false,
        ebayRequired: false,
        ebayMapping: "Brand",
        order: 99,
      },
    ];
    const items = [
      {
        id: "i1",
        data: makeItem({
          fields: { ...makeItem().fields, brand: "Acme" },
        }),
      },
    ];
    const { csv, columns } = buildEbayCsv(items, new Map([["folder-1", customSchema]]));
    expect(columns).toContain("C:Brand");
    const parsed = parseCsv(csv);
    const idx = columns.indexOf("C:Brand");
    expect(parsed[1][idx]).toBe("Acme");
  });

  it("escapes commas and quotes inside cells", () => {
    const schema = defaultFieldSchema();
    const items = [
      {
        id: "i1",
        data: makeItem({
          fields: {
            ...makeItem().fields,
            title: 'Camera, "vintage"',
          },
        }),
      },
    ];
    const { csv } = buildEbayCsv(items, new Map([["folder-1", schema]]));
    const parsed = parseCsv(csv);
    const titleIdx = parsed[0].indexOf("Title");
    expect(parsed[1][titleIdx]).toBe('Camera, "vintage"');
  });

  it("round-trips: export → import maps cells back via ebayMapping", () => {
    const schema: FieldDef[] = [
      ...defaultFieldSchema(),
      {
        key: "brand",
        label: "Brand",
        type: "text",
        required: false,
        ebayRequired: false,
        ebayMapping: "Brand", // custom item-specific
        order: 99,
      },
    ];
    const original = makeItem({
      fields: {
        title: "Vintage radio",
        description: "Works fine",
        sku: "SKU-99",
        price: 49.95,
        quantity: 1,
        condition: "Used – Good",
        brand: "Grundig",
      },
    });

    const { csv, columns } = buildEbayCsv(
      [{ id: "i1", data: original }],
      new Map([["folder-1", schema]]),
    );
    const rows = parseCsv(csv);
    const row = rows[1];

    // Reverse-map columns the same way inventoryImport's ebay-csv branch does.
    const reMapped: Record<string, unknown> = {};
    columns.forEach((col, idx) => {
      const mapping = col.startsWith("C:") ? col.slice(2) : col;
      if (["Action", "PicURL", "Country", "Currency", "Format", "Duration"].includes(col)) {
        return;
      }
      const def = schema.find((f) => f.ebayMapping === mapping);
      if (def) reMapped[def.key] = row[idx];
    });

    expect(reMapped.title).toBe("Vintage radio");
    expect(reMapped.description).toBe("Works fine");
    expect(reMapped.sku).toBe("SKU-99");
    expect(reMapped.brand).toBe("Grundig");
    // Numbers come back as strings from CSV; validateItemFields would coerce them.
    expect(reMapped.price).toBe("49.95");
    expect(reMapped.quantity).toBe("1");
  });
});
