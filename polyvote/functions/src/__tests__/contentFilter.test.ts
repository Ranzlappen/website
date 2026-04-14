import { describe, it, expect } from 'vitest';
import { moderateContent, moderateFields } from '../utils/contentFilter';

describe('contentFilter', () => {
  describe('moderateContent', () => {
    it('passes clean text', () => {
      const result = moderateContent('This is a perfectly normal comment about climate policy.');
      expect(result.blocked).toBe(false);
    });

    it('passes normal discussion text', () => {
      expect(moderateContent('I think we should invest more in renewable energy').blocked).toBe(false);
      expect(moderateContent('The voting results look great!').blocked).toBe(false);
      expect(moderateContent('I disagree with this metric').blocked).toBe(false);
    });

    it('blocks racial slurs', () => {
      const result = moderateContent('You are a kike');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('slur');
    });

    it('blocks threats', () => {
      const result = moderateContent("I'll kill you");
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('threat');
    });

    it('blocks "kys" threat', () => {
      const result = moderateContent('just kys');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('threat');
    });

    it('blocks illegal content patterns', () => {
      const result = moderateContent('child porn link');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('illegal');
    });

    it('blocks doxxing', () => {
      const result = moderateContent('I will doxx you');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('illegal');
    });

    it('blocks spam (excessive caps)', () => {
      const result = moderateContent('THIS IS ALL CAPS AND VERY LONG SPAM TEXT');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('spam');
    });

    it('blocks spam (repeated characters)', () => {
      const result = moderateContent('aaaaaaaaaa');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('spam');
    });

    it('blocks SSN patterns', () => {
      const result = moderateContent('my SSN is 123-45-6789');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('pii');
    });

    it('blocks phone numbers with context', () => {
      const result = moderateContent('call me at 555-123-4567');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('pii');
    });

    it('does not block numbers without sharing context', () => {
      // A bare number without "call me" etc. should pass
      const result = moderateContent('The vote count was 555-123-4567');
      expect(result.blocked).toBe(false);
    });

    it('blocks leet-speak evasion', () => {
      // Leet speak substitution should be normalized and caught
      const result = moderateContent('h3il hitler');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('slur');
    });

    it('blocks white supremacy phrases', () => {
      const result = moderateContent('white power forever');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('slur');
    });
  });

  describe('moderateFields', () => {
    it('passes when all fields are clean', () => {
      const result = moderateFields([
        { name: 'title', value: 'Climate Change' },
        { name: 'description', value: 'Discussion about climate policy' },
      ]);
      expect(result.blocked).toBe(false);
    });

    it('returns the first blocked field', () => {
      const result = moderateFields([
        { name: 'title', value: 'Normal title' },
        { name: 'description', value: "I'll kill you" },
      ]);
      expect(result.blocked).toBe(true);
      expect(result.field).toBe('description');
      expect(result.category).toBe('threat');
    });
  });
});
