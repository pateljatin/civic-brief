import { describe, it, expect } from 'vitest';
import { scenarios, getScenarioBySlug } from '@/lib/showcase';

const REQUIRED_SLUGS = ['budget', 'school-board', 'zoning', 'legislation', 'drug-pricing'] as const;

describe('showcase scenarios', () => {
  it('exports exactly 5 scenarios', () => {
    expect(scenarios).toHaveLength(5);
  });

  it('has unique slugs', () => {
    const slugs = scenarios.map((s) => s.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(scenarios.length);
  });

  it('has all required slugs', () => {
    const slugs = scenarios.map((s) => s.slug);
    for (const required of REQUIRED_SLUGS) {
      expect(slugs).toContain(required);
    }
  });

  it('every scenario has non-empty required string fields', () => {
    for (const scenario of scenarios) {
      expect(scenario.slug.length).toBeGreaterThan(0);
      expect(scenario.title.length).toBeGreaterThan(0);
      expect(scenario.icon.length).toBeGreaterThan(0);
      expect(scenario.color.length).toBeGreaterThan(0);
      expect(scenario.jurisdiction.length).toBeGreaterThan(0);
      expect(scenario.narrative.length).toBeGreaterThan(0);
      expect(scenario.story.length).toBeGreaterThan(0);
      expect(scenario.documentTitle.length).toBeGreaterThan(0);
      expect(scenario.sourceUrl.length).toBeGreaterThan(0);
    }
  });

  it('briefId can be null for every scenario', () => {
    for (const scenario of scenarios) {
      expect(scenario.briefId === null || typeof scenario.briefId === 'string').toBe(true);
    }
  });

  it('sourceUrls are valid HTTP(S) URLs', () => {
    for (const scenario of scenarios) {
      expect(() => new URL(scenario.sourceUrl)).not.toThrow();
      const parsed = new URL(scenario.sourceUrl);
      expect(['http:', 'https:']).toContain(parsed.protocol);
    }
  });

  it('colors are valid hex color strings', () => {
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    for (const scenario of scenarios) {
      expect(scenario.color).toMatch(hexPattern);
    }
  });
});

describe('getScenarioBySlug', () => {
  it('returns the correct scenario for a valid slug', () => {
    for (const required of REQUIRED_SLUGS) {
      const result = getScenarioBySlug(required);
      expect(result).toBeDefined();
      expect(result?.slug).toBe(required);
    }
  });

  it('returns undefined for an invalid slug', () => {
    expect(getScenarioBySlug('nonexistent')).toBeUndefined();
    expect(getScenarioBySlug('')).toBeUndefined();
    expect(getScenarioBySlug('BUDGET')).toBeUndefined();
  });

  it('returns a scenario with all required fields populated', () => {
    const result = getScenarioBySlug('budget');
    expect(result).toBeDefined();
    if (!result) return;
    expect(result.title).toBe('Budget Season');
    expect(result.icon).toBe('💰');
    expect(result.color).toBe('#1a2332');
    expect(result.jurisdiction).toContain('Philadelphia');
  });
});
