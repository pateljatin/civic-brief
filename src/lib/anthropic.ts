import Anthropic from '@anthropic-ai/sdk';

export const MODEL = 'claude-sonnet-4-20250514' as const;
export const PROMPT_VERSION = 'civic-v1.0' as const;

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Add it to .env.local to enable AI features.'
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function generateJSON<T>(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4096
): Promise<T> {
  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Extract JSON from the response (handle markdown code fences)
  let jsonText = textBlock.text.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonText = fenceMatch[1].trim();
  }

  return JSON.parse(jsonText) as T;
}
