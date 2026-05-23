import { describe, it, expect } from "vitest";
import {
  coreFieldSchema,
  ensureTagColumns,
  fieldsForTags,
  missingForPlatform,
  platformsForField,
} from "../platforms";

describe("fieldsForTags", () => {
  it("returns the canonical core for no tags", () => {
    const keys = fieldsForTags([]).map((f) => f.key);
    expect(keys).toEqual(["title", "sku", "price", "quantity", "description", "condition"]);
  });

  it("includes platform-specific canonical fields for a tag", () => {
    const keys = fieldsForTags(["facebook"]).map((f) => f.key);
    expect(keys).toContain("product_url");
    expect(keys).toContain("availability");
    expect(keys).toContain("ean");
  });

  it("stamps the owning tags on each generated column", () => {
    const f = fieldsForTags(["ebay", "amazon"]);
    const title = f.find((x) => x.key === "title")!;
    expect(title.platforms.sort()).toEqual(["amazon", "ebay"]);
  });
});

describe("ensureTagColumns", () => {
  it("adds missing columns when a tag is applied and keeps them when stripped", () => {
    const withEbay = ensureTagColumns(coreFieldSchema(), ["ebay"]);
    expect(withEbay.find((f) => f.key === "brand")?.platforms).toEqual(["ebay"]);
    const postal = withEbay.find((f) => f.key === "postal_code");
    expect(postal).toBeTruthy();

    // Strip the tag: columns stay, badges (platforms) drop to [].
    const stripped = ensureTagColumns(withEbay, []);
    expect(stripped.length).toBe(withEbay.length);
    expect(stripped.find((f) => f.key === "brand")?.platforms).toEqual([]);
    expect(stripped.find((f) => f.key === "postal_code")?.platforms).toEqual([]);
  });

  it("merges platform membership for shared columns", () => {
    const schema = ensureTagColumns(coreFieldSchema(), ["ebay", "facebook"]);
    const price = schema.find((f) => f.key === "price")!;
    expect(price.platforms.sort()).toEqual(["ebay", "facebook"]);
  });

  it("reindexes order sequentially", () => {
    const schema = ensureTagColumns(coreFieldSchema(), ["ebay", "idealo"]);
    expect(schema.map((f) => f.order)).toEqual(schema.map((_f, i) => i));
  });
});

describe("platformsForField", () => {
  it("lists each platform's exact column for a canonical key", () => {
    const price = platformsForField("price");
    const ebay = price.find((p) => p.platform === "ebay")!;
    expect(ebay.column).toBe("*StartPrice");
    expect(ebay.required).toBe(true);
    expect(price.find((p) => p.platform === "facebook")?.column).toBe("price");
    expect(price.find((p) => p.platform === "billiger")?.column).toBe("price");
  });
});

describe("missingForPlatform", () => {
  it("flags missing required columns by exact name", () => {
    const missing = missingForPlatform({ fields: { title: "" }, photos: [] }, "ebay");
    expect(missing).toContain("*Title");
    expect(missing).toContain("*StartPrice");
  });

  it("treats an empty photo list as a missing required image for Facebook", () => {
    const missing = missingForPlatform(
      { fields: { sku: "s", title: "t", description: "d", price: 1, condition: "New", product_url: "https://x" }, photos: [] },
      "facebook"
    );
    expect(missing).toContain("image_link");
  });

  it("returns empty when all required fields are present", () => {
    const missing = missingForPlatform(
      {
        fields: { title: "t", description: "d", price: 1, quantity: 1, condition: "New", sku: "s" },
        photos: [{ downloadUrl: "https://x" }],
      },
      "ebay"
    );
    expect(missing).toEqual([]);
  });
});
