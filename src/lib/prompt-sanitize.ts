/**
 * Strip common prompt injection patterns from extracted document text.
 * This is defense-in-depth; XML delimiters are the primary boundary.
 */
export function sanitizeDocumentText(text: string): string {
  return text
    // Remove "ignore previous/all instructions" patterns
    .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/gi, '[redacted]')
    // Remove "you are now" role reassignment
    .replace(/you\s+are\s+now\s+/gi, '[redacted] ')
    // Remove "system:" prefix attempts
    .replace(/^system\s*:/gmi, '[redacted]:')
    // Remove XML-like closing tags that could break our delimiters
    .replace(/<\/?source_document>/gi, '[redacted]')
    .replace(/<\/?civic_summary>/gi, '[redacted]');
}
