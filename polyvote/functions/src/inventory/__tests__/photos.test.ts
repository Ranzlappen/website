import { describe, it, expect } from "vitest";
import { extractDriveFolderId, resolveImageUrl } from "../photos";

describe("resolveImageUrl", () => {
  it("normalizes a Drive /file/d/<ID>/view URL", () => {
    expect(
      resolveImageUrl(
        "https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0JKLMNOPQ/view?usp=sharing",
      ),
    ).toBe(
      "https://drive.google.com/uc?export=download&id=1A2B3C4D5E6F7G8H9I0JKLMNOPQ",
    );
  });

  it("normalizes a Drive open?id= URL", () => {
    expect(
      resolveImageUrl("https://drive.google.com/open?id=ABC123-_xyz45678901234567"),
    ).toBe(
      "https://drive.google.com/uc?export=download&id=ABC123-_xyz45678901234567",
    );
  });

  it("normalizes a raw Drive file id", () => {
    expect(resolveImageUrl("1A2B3C4D5E6F7G8H9I0JKLMNOPQ")).toBe(
      "https://drive.google.com/uc?export=download&id=1A2B3C4D5E6F7G8H9I0JKLMNOPQ",
    );
  });

  it("passes through unrelated HTTPS URLs unchanged", () => {
    const u = "https://example.com/photos/cat.jpg";
    expect(resolveImageUrl(u)).toBe(u);
  });

  it("rejects empty input", () => {
    expect(() => resolveImageUrl("")).toThrow(/required/);
  });

  it("rejects malformed URLs", () => {
    expect(() => resolveImageUrl("not a url")).toThrow(/valid URL/);
  });

  it("rejects ftp / file URLs", () => {
    expect(() => resolveImageUrl("ftp://example.com/x.jpg")).toThrow(/http/);
  });
});

describe("extractDriveFolderId", () => {
  it("accepts /drive/folders/<id>", () => {
    expect(
      extractDriveFolderId(
        "https://drive.google.com/drive/folders/1abcdefGHIJK_LMNOPQRSTUV2",
      ),
    ).toBe("1abcdefGHIJK_LMNOPQRSTUV2");
  });

  it("accepts /drive/u/0/folders/<id>?usp=sharing", () => {
    expect(
      extractDriveFolderId(
        "https://drive.google.com/drive/u/0/folders/1abcdefGHIJK_LMNOPQRSTUV2?usp=sharing",
      ),
    ).toBe("1abcdefGHIJK_LMNOPQRSTUV2");
  });

  it("accepts a raw folder id", () => {
    expect(extractDriveFolderId("1abcdefGHIJK_LMNOPQRSTUV2")).toBe(
      "1abcdefGHIJK_LMNOPQRSTUV2",
    );
  });

  it("rejects URLs without /folders/<id>", () => {
    expect(() =>
      extractDriveFolderId("https://drive.google.com/file/d/abc/view"),
    ).toThrow(/folders/);
  });

  it("rejects non-Drive hosts", () => {
    expect(() =>
      extractDriveFolderId("https://example.com/folders/abc"),
    ).toThrow(/drive\.google\.com/);
  });
});
