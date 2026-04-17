const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export type PDFErrorCode =
  | 'FILE_TOO_LARGE'
  | 'FILE_TOO_SMALL'
  | 'NOT_A_PDF'
  | 'PASSWORD_PROTECTED'
  | 'SCANNED_IMAGE'
  | 'EXTRACTION_FAILED'
  | 'CORRUPTED';

export class PDFExtractionError extends Error {
  code: PDFErrorCode;

  constructor(message: string, code: PDFErrorCode) {
    super(message);
    this.name = 'PDFExtractionError';
    this.code = code;
  }
}

/**
 * Detect if a PDF buffer is password-protected by scanning for the /Encrypt dictionary.
 * This is a heuristic — it checks the raw bytes for the /Encrypt marker.
 */
function isPasswordProtected(buffer: ArrayBuffer): boolean {
  // Scan first 4KB and last 4KB for /Encrypt entry (common location in cross-reference table)
  const bytes = new Uint8Array(buffer);
  const scanSize = Math.min(4096, bytes.length);
  const tail = bytes.subarray(Math.max(0, bytes.length - scanSize));
  const head = bytes.subarray(0, scanSize);

  const encryptMarker = [47, 69, 110, 99, 114, 121, 112, 116]; // '/Encrypt' in ASCII
  const searchIn = (chunk: Uint8Array): boolean => {
    for (let i = 0; i <= chunk.length - encryptMarker.length; i++) {
      if (encryptMarker.every((byte, j) => chunk[i + j] === byte)) return true;
    }
    return false;
  };

  return searchIn(head) || searchIn(tail);
}

/**
 * Extract text from a PDF buffer in memory. Never writes to disk.
 * Returns the full text content of the PDF.
 */
export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new PDFExtractionError(
      `This PDF is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB, which exceeds the 10 MB limit. Try splitting the document or uploading a smaller section.`,
      'FILE_TOO_LARGE'
    );
  }

  if (buffer.byteLength < 100) {
    throw new PDFExtractionError(
      'The uploaded file appears to be empty or incomplete. Please check the file and try again.',
      'FILE_TOO_SMALL'
    );
  }

  // Check PDF magic bytes
  const header = new Uint8Array(buffer.slice(0, 5));
  const magic = String.fromCharCode.apply(null, Array.from(header));
  if (magic !== '%PDF-') {
    throw new PDFExtractionError(
      'The uploaded file is not a PDF. Please upload a PDF document (the file should end in .pdf).',
      'NOT_A_PDF'
    );
  }

  // Detect password-protected PDFs before attempting extraction
  if (isPasswordProtected(buffer)) {
    throw new PDFExtractionError(
      'This PDF is password-protected. Please remove the password and upload again, or contact your agency for an unlocked version.',
      'PASSWORD_PROTECTED'
    );
  }

  let result: { text: string | string[]; totalPages: number };
  try {
    const { extractText } = await import('unpdf');
    result = await extractText(new Uint8Array(buffer));
  } catch (err) {
    // unpdf throws on truly corrupted files (bad xref table, truncated stream, etc.)
    const message = err instanceof Error ? err.message.toLowerCase() : '';
    if (message.includes('password') || message.includes('encrypt')) {
      throw new PDFExtractionError(
        'This PDF is password-protected. Please remove the password and upload again, or contact your agency for an unlocked version.',
        'PASSWORD_PROTECTED'
      );
    }
    throw new PDFExtractionError(
      'This PDF could not be read. The file may be damaged or in an unsupported format. Try re-downloading it from the government website.',
      'CORRUPTED'
    );
  }

  // unpdf returns text as string or string[] depending on version
  const rawText = Array.isArray(result.text)
    ? result.text.join('\n')
    : result.text;

  if (!rawText || rawText.trim().length === 0) {
    throw new PDFExtractionError(
      'No text could be extracted from this PDF. It is likely a scanned document (a photo of a page). Civic Brief requires text-based PDFs. Contact your agency to request an accessible version.',
      'SCANNED_IMAGE'
    );
  }

  // Basic heuristic for scanned PDFs: very little text relative to page count
  const charsPerPage = rawText.trim().length / Math.max(result.totalPages, 1);
  if (charsPerPage < 50) {
    throw new PDFExtractionError(
      'This PDF appears to be a scanned image with very little readable text. Civic Brief requires text-based PDFs. Contact your agency to request an accessible version.',
      'SCANNED_IMAGE'
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
