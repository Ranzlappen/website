import { describe, it, expect } from 'vitest';
import { validateString, validateCategory, validateMetrics, VALID_CATEGORIES } from '../utils/validation';

describe('validation', () => {
  describe('validateString', () => {
    it('returns trimmed string for valid input', () => {
      expect(validateString('  hello  ', 'test')).toBe('hello');
    });

    it('throws on empty string', () => {
      expect(() => validateString('', 'title')).toThrow('title must be a non-empty string');
    });

    it('throws on whitespace-only string', () => {
      expect(() => validateString('   ', 'title')).toThrow('title must be a non-empty string');
    });

    it('throws on non-string input', () => {
      expect(() => validateString(123 as unknown, 'field')).toThrow('field must be a non-empty string');
      expect(() => validateString(null as unknown, 'field')).toThrow('field must be a non-empty string');
      expect(() => validateString(undefined as unknown, 'field')).toThrow('field must be a non-empty string');
    });

    it('throws when exceeding max length', () => {
      const long = 'a'.repeat(3000);
      expect(() => validateString(long, 'desc')).toThrow('desc must be at most 2000 characters');
    });

    it('accepts string at max length', () => {
      const exact = 'a'.repeat(2000);
      expect(validateString(exact, 'desc')).toBe(exact);
    });

    it('respects custom max length', () => {
      expect(() => validateString('hello world', 'title', 5)).toThrow('title must be at most 5 characters');
    });
  });

  describe('validateCategory', () => {
    it('accepts all valid categories', () => {
      for (const cat of VALID_CATEGORIES) {
        expect(validateCategory(cat)).toBe(cat);
      }
    });

    it('throws on invalid category', () => {
      expect(() => validateCategory('Invalid')).toThrow('Invalid category');
    });

    it('throws on non-string', () => {
      expect(() => validateCategory(42 as unknown)).toThrow('Invalid category');
    });
  });

  describe('validateMetrics', () => {
    const validMetric = {
      id: 'm1',
      label: 'Quality',
      choices: [
        { id: 'c1', label: 'High', color: '#ff0000', votes: 0 },
        { id: 'c2', label: 'Low', color: '#00ff00', votes: 0 },
      ],
    };

    it('accepts valid metrics array', () => {
      const result = validateMetrics([validMetric]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('m1');
      expect(result[0].choices).toHaveLength(2);
    });

    it('throws on empty array', () => {
      expect(() => validateMetrics([])).toThrow('non-empty array');
    });

    it('throws on non-array', () => {
      expect(() => validateMetrics('not an array' as unknown)).toThrow('non-empty array');
    });

    it('throws when exceeding 6 metrics', () => {
      const metrics = Array.from({ length: 7 }, (_, i) => ({
        ...validMetric,
        id: `m${i}`,
      }));
      expect(() => validateMetrics(metrics)).toThrow('at most 6 metrics');
    });

    it('throws on metric without id', () => {
      expect(() => validateMetrics([{ label: 'Q', choices: [{ id: 'c1', label: 'A', color: '#000', votes: 0 }] }])).toThrow('Metric 0 must have id and label');
    });

    it('throws on metric without choices', () => {
      expect(() => validateMetrics([{ id: 'm1', label: 'Q', choices: [] }])).toThrow('Metric 0 must have at least one choice');
    });

    it('defaults votes to 0 when not provided', () => {
      const result = validateMetrics([{
        id: 'm1',
        label: 'Q',
        choices: [{ id: 'c1', label: 'A', color: '#000' }],
      }]);
      expect(result[0].choices[0].votes).toBe(0);
    });
  });
});
