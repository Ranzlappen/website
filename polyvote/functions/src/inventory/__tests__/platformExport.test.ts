import { describe, it, expect } from "vitest";
import { buildPlatformFile } from "../platformExport";
import { defaultEbayBlock, type ItemDoc } from "../shared";
import { parseCsv } from "../csv";

type ItemWithId = ItemDoc & { id: string };

function makeItem(overrides: Partial<ItemWithId> = {}): ItemWithId {
  return {
    id: "i1",
    folderId: "folder-1",
    fields: {
      title: "Test item",
      description: "A test",
      sku: "SKU-001",
      price: 19.99,
      quantity: 2,
      condition: "New",
      brand: "Acme",
      ean: "4006381333931",
      product_url: "https://shop.example/p/1",
    },
    photos: [
      {
        storagePath: "inventory/x/a.jpg",
        downloadUrl: "https://cdn/a.jpg",
        filename: "a.jpg",
        sizeBytes: 1,
        width: 8,
        height: 6,
        order: 0,
      },
      {
        storagePath: "inventory/x/b.jpg",
        downloadUrl: "https://cdn/b.jpg",
        filename: "b.jpg",
        sizeBytes: 1,
        width: 8,
        height: 6,
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

describe("buildPlatformFile — eBay CSV", () => {
  it("emits asterisk headers, numeric ConditionID, piped PicURL", () => {
    const { body } = buildPlatformFile("ebay", "csv", [makeItem()]);
    const rows = parseCsv(body);
    const cols = rows[0];
    expect(cols).toContain("*Title");
    expect(cols).toContain("*StartPrice");
    expect(cols).toContain("Country");
    expect(rows[1][cols.indexOf("*Title")]).toBe("Test item");
    expect(rows[1][cols.indexOf("*ConditionID")]).toBe("1000");
    expect(rows[1][cols.indexOf("PicURL")]).toBe("https://cdn/a.jpg|https://cdn/b.jpg");
    expect(rows[1][cols.indexOf("Country")]).toBe("DE");
    expect(rows[1][cols.indexOf("C:Brand")]).toBe("Acme");
  });

  it("uses Revise once a listingId exists", () => {
    const item = makeItem({ ebay: { ...defaultEbayBlock(), listingId: "123" } });
    const { body } = buildPlatformFile("ebay", "csv", [item]);
    const rows = parseCsv(body);
    expect(rows[1][rows[0].indexOf("*Action")]).toBe("Revise");
  });
});

describe("buildPlatformFile — Amazon TSV", () => {
  it("is tab-delimited with underscore tokens + EAN id type", () => {
    const { body, fileExt } = buildPlatformFile("amazon", "tsv", [makeItem()]);
    expect(fileExt).toBe("txt");
    const rows = parseCsv(body, "\t");
    expect(rows[0]).toContain("item_name");
    expect(rows[0]).toContain("standard_price");
    expect(rows[0]).toContain("external_product_id_type");
    expect(rows[1][rows[0].indexOf("condition_type")]).toBe("New");
    expect(rows[1][rows[0].indexOf("external_product_id_type")]).toBe("EAN");
  });
});

describe("buildPlatformFile — Facebook", () => {
  it("CSV uses lowercase tokens, price with currency, new/used condition", () => {
    const { body } = buildPlatformFile("facebook", "csv", [makeItem()]);
    const rows = parseCsv(body);
    expect(rows[0]).toContain("image_link");
    expect(rows[1][rows[0].indexOf("price")]).toBe("19.99 EUR");
    expect(rows[1][rows[0].indexOf("condition")]).toBe("new");
    expect(rows[1][rows[0].indexOf("image_link")]).toBe("https://cdn/a.jpg");
    expect(rows[1][rows[0].indexOf("additional_image_link")]).toBe("https://cdn/b.jpg");
  });

  it("XML emits a valid RSS feed with g: tags", () => {
    const { body, fileExt } = buildPlatformFile("facebook", "xml", [makeItem()]);
    expect(fileExt).toBe("xml");
    expect(body).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(body).toContain("<g:title>Test item</g:title>");
    expect(body).toContain("<g:price>19.99 EUR</g:price>");
  });
});

describe("buildPlatformFile — blocked items", () => {
  it("skips items missing required fields and reports them", () => {
    const ok = makeItem({ id: "ok" });
    const bad = makeItem({ id: "bad", fields: { ...makeItem().fields, title: "" } });
    const { rowCount, blocked } = buildPlatformFile("ebay", "csv", [ok, bad]);
    expect(rowCount).toBe(1);
    expect(blocked).toEqual([{ id: "bad", missing: expect.arrayContaining(["*Title"]) }]);
  });
});

describe("buildPlatformFile — escaping", () => {
  it("escapes the active delimiter inside cells", () => {
    const item = makeItem({ fields: { ...makeItem().fields, title: 'Camera, "vintage"' } });
    const { body } = buildPlatformFile("ebay", "csv", [item]);
    const rows = parseCsv(body);
    expect(rows[1][rows[0].indexOf("*Title")]).toBe('Camera, "vintage"');
  });
});
