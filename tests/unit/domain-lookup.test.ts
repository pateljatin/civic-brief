import { describe, it, expect } from 'vitest';
import { extractDomain, lookupJurisdictionByDomain } from '@/lib/domain-lookup';

describe('domain-lookup', () => {
  describe('extractDomain', () => {
    it('extracts domain from a standard URL', () => {
      expect(extractDomain('https://seattle.gov/budget/2026')).toBe('seattle.gov');
    });

    it('strips www prefix', () => {
      expect(extractDomain('https://www.seattle.gov/documents')).toBe('seattle.gov');
    });

    it('lowercases the domain', () => {
      expect(extractDomain('https://WWW.Seattle.Gov/path')).toBe('seattle.gov');
    });

    it('returns null for invalid URLs', () => {
      expect(extractDomain('not a url')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(extractDomain('')).toBeNull();
    });

    it('handles URLs with ports', () => {
      expect(extractDomain('https://seattle.gov:8080/api')).toBe('seattle.gov');
    });

    it('handles subdomains', () => {
      expect(extractDomain('https://council.nyc.gov/meetings')).toBe('council.nyc.gov');
    });
  });

  describe('lookupJurisdictionByDomain', () => {
    it('finds Seattle from seattle.gov', () => {
      expect(lookupJurisdictionByDomain('https://seattle.gov/budget')).toBe(
        '00000000-0000-0000-0000-000000000004'
      );
    });

    it('finds King County from kingcounty.gov', () => {
      expect(lookupJurisdictionByDomain('https://kingcounty.gov/council')).toBe(
        '00000000-0000-0000-0000-000000000003'
      );
    });

    it('finds federal from congress.gov', () => {
      expect(lookupJurisdictionByDomain('https://www.congress.gov/bill/118')).toBe(
        '00000000-0000-0000-0000-000000000001'
      );
    });

    it('walks up subdomains: council.nyc.gov -> nyc.gov -> NYC', () => {
      expect(lookupJurisdictionByDomain('https://council.nyc.gov/hearing')).toBe(
        '00000000-0000-0000-0000-000000000022'
      );
    });

    it('returns null for unknown domains', () => {
      expect(lookupJurisdictionByDomain('https://example.com/doc.pdf')).toBeNull();
    });

    it('returns null for invalid URLs', () => {
      expect(lookupJurisdictionByDomain('not-a-url')).toBeNull();
    });

    it('handles www prefix correctly', () => {
      expect(lookupJurisdictionByDomain('https://www.wa.gov/laws')).toBe(
        '00000000-0000-0000-0000-000000000002'
      );
    });

    it('finds Philadelphia from phila.gov', () => {
      expect(lookupJurisdictionByDomain('https://phila.gov/budget')).toBe(
        '00000000-0000-0000-0000-000000000020'
      );
    });

    it('finds Atlanta from atlantaga.gov', () => {
      expect(lookupJurisdictionByDomain('https://atlantaga.gov/ordinance')).toBe(
        '00000000-0000-0000-0000-000000000021'
      );
    });
  });
});
