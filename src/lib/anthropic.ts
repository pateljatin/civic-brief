import Anthropic from '@anthropic-ai/sdk';

export const MODEL = 'claude-sonnet-4-6' as const;
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

  // Check if response was truncated
  if (response.stop_reason === 'max_tokens') {
    console.error('Claude response truncated (max_tokens). Consider increasing maxTokens.');
  }

  // Extract JSON from the response (handle markdown code fences)
  let jsonText = textBlock.text.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonText = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(jsonText) as T;
  } catch (parseError) {
    // Try extracting the outermost JSON object as fallback
    const objMatch = jsonText.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]) as T;
      } catch {
        // Fall through to error
      }
    }
    console.error('JSON parse failed. Raw response (first 500 chars):', jsonText.slice(0, 500));
    console.error('Last 200 chars:', jsonText.slice(-200));
    console.error('Response length:', jsonText.length, 'stop_reason:', response.stop_reason);
    throw new Error(
      response.stop_reason === 'max_tokens'
        ? 'AI response was too long and got cut off. Try a shorter document.'
        : 'Failed to parse AI response. Please try again.'
    );
  }
}
