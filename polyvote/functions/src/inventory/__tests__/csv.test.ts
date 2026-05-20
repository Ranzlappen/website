import { describe, it, expect } from "vitest";
import { parseCsv, serializeCsv, escapeCsvCell } from "../csv";

describe("csv", () => {
  describe("escapeCsvCell", () => {
    it("returns plain text untouched", () => {
      expect(escapeCsvCell("hello")).toBe("hello");
    });
    it("wraps cells with commas", () => {
      expect(escapeCsvCell("a,b")).toBe('"a,b"');
    });
    it("doubles embedded quotes", () => {
      expect(escapeCsvCell('he said "hi"')).toBe('"he said ""hi"""');
    });
    it("wraps cells with newlines", () => {
      expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    });
    it("handles null and undefined", () => {
      expect(escapeCsvCell(null)).toBe("");
      expect(escapeCsvCell(undefined)).toBe("");
    });
  });

  describe("serializeCsv → parseCsv roundtrip", () => {
    it("roundtrips simple data", () => {
      const data = [
        ["a", "b", "c"],
        ["1", "2", "3"],
      ];
      const parsed = parseCsv(serializeCsv(data));
      expect(parsed).toEqual(data);
    });

    it("roundtrips commas, quotes, and newlines", () => {
      const data = [
        ["name", "note"],
        ["foo, bar", 'he said "hello"'],
        ["baz", "multi\nline"],
      ];
      const parsed = parseCsv(serializeCsv(data));
      expect(parsed).toEqual(data);
    });

    it("handles empty cells", () => {
      const data = [
        ["a", "b", "c"],
        ["", "x", ""],
      ];
      const parsed = parseCsv(serializeCsv(data));
      expect(parsed).toEqual(data);
    });
  });

  describe("parseCsv", () => {
    it("strips BOM", () => {
      const input = "﻿a,b\n1,2\n";
      expect(parseCsv(input)).toEqual([
        ["a", "b"],
        ["1", "2"],
      ]);
    });

    it("treats CRLF as one line break", () => {
      expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
        ["a", "b"],
        ["1", "2"],
      ]);
    });

    it("handles trailing row without newline", () => {
      expect(parseCsv("a,b\n1,2")).toEqual([
        ["a", "b"],
        ["1", "2"],
      ]);
    });
  });
});
