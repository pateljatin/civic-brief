import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ai/models', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('exports civic and infra model groups', async () => {
    const { civic, infra } = await import('@/lib/ai/models');
    expect(civic).toBeDefined();
    expect(infra).toBeDefined();
  });

  it('civic has summarize, verify, and translate models', async () => {
    const { civic } = await import('@/lib/ai/models');
    expect(civic.summarize).toBeDefined();
    expect(civic.verify).toBeDefined();
    expect(civic.translate).toBeDefined();
  });

  it('infra has evalVision, evalReadability, and evalTone models', async () => {
    const { infra } = await import('@/lib/ai/models');
    expect(infra.evalVision).toBeDefined();
    expect(infra.evalReadability).toBeDefined();
    expect(infra.evalTone).toBeDefined();
  });

  it('civic models use anthropic provider', async () => {
    const { civic } = await import('@/lib/ai/models');
    // Check the provider property - may be 'anthropic.chat' or similar
    // Inspect the actual object to find the right property
    expect(civic.summarize.provider).toContain('anthropic');
  });

  it('infra models use google provider', async () => {
    const { infra } = await import('@/lib/ai/models');
    expect(infra.evalVision.provider).toContain('google');
  });

  it('uses default model IDs when env vars not set', async () => {
    delete process.env.CIVIC_MODEL;
    delete process.env.INFRA_MODEL;
    const { civic, infra } = await import('@/lib/ai/models');
    expect(civic.summarize.modelId).toBe('claude-sonnet-4.6');
    expect(infra.evalVision.modelId).toBe('gemini-2.5-flash');
  });

  it('respects CIVIC_MODEL env var override', async () => {
    process.env.CIVIC_MODEL = 'claude-haiku-4.5';
    const { civic } = await import('@/lib/ai/models');
    expect(civic.summarize.modelId).toBe('claude-haiku-4.5');
  });

  it('respects INFRA_MODEL env var override', async () => {
    process.env.INFRA_MODEL = 'gemini-2.0-flash';
    const { infra } = await import('@/lib/ai/models');
    expect(infra.evalVision.modelId).toBe('gemini-2.0-flash');
  });
});
