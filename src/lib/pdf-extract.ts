const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export class PDFExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PDFExtractionError';
  }
}

/**
 * Extract text from a PDF buffer in memory. Never writes to disk.
 * Returns the full text content of the PDF.
 */
export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new PDFExtractionError(
      `File too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`
    );
  }

  if (buffer.byteLength < 100) {
    throw new PDFExtractionError('File is too small to be a valid PDF.');
  }

  // Check PDF magic bytes
  const header = new Uint8Array(buffer.slice(0, 5));
  const magic = String.fromCharCode.apply(null, Array.from(header));
  if (magic !== '%PDF-') {
    throw new PDFExtractionError(
      'Not a valid PDF file. Make sure you are uploading a PDF document.'
    );
  }

  const { extractText } = await import('unpdf');
  const result = await extractText(new Uint8Array(buffer));

  // unpdf returns text as string or string[] depending on version
  const rawText = Array.isArray(result.text)
    ? result.text.join('\n')
    : result.text;

  if (!rawText || rawText.trim().length === 0) {
    throw new PDFExtractionError(
      'Could not extract text from this PDF. It may be a scanned document (image-only). Civic Brief currently supports text-based PDFs only.'
    );
  }

  // Basic heuristic for scanned PDFs: very little text relative to page count
  const charsPerPage = rawText.trim().length / Math.max(result.totalPages, 1);
  if (charsPerPage < 50) {
    throw new PDFExtractionError(
      'This PDF appears to be scanned or image-based. Civic Brief currently supports text-based PDFs only.'
    );
  }

  return rawText.trim();
}

/**
 * Compute SHA-256 hash of text content for deduplication.
 */
export async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
