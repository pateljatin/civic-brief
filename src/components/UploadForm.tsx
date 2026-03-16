'use client';

import { useState, useRef } from 'react';
import type { CivicContent, VerificationResult, PipelineStep } from '@/lib/types';

interface UploadResult {
  sourceId: string | null;
  briefId: string | null;
  brief: {
    headline: string;
    summary: string;
    content: CivicContent;
    confidence_score: number;
    confidence_level: 'high' | 'medium' | 'low';
  };
  verification: VerificationResult;
  translations: Array<{
    language: string;
    briefId: string | null;
    headline?: string;
    content?: CivicContent;
  }>;
  duplicate?: boolean;
  message?: string;
}

interface UploadFormProps {
  onResult?: (result: UploadResult) => void;
}

const PIPELINE_LABELS: Record<PipelineStep, string> = {
  extracting: 'Extracting text from PDF...',
  summarizing: 'Generating civic summary...',
  verifying: 'Running factuality check...',
  translating: 'Translating to Spanish...',
  saving: 'Saving civic brief...',
  complete: 'Done!',
  error: 'Something went wrong.',
};

export default function UploadForm({ onResult }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [step, setStep] = useState<PipelineStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isProcessing = step !== null && step !== 'complete' && step !== 'error';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !sourceUrl) return;

    setError(null);
    setStep('extracting');

    try {
      // Simulate visible pipeline steps for UX
      // (The API does all steps server-side, but we show progress)
      const progressTimer = setTimeout(() => setStep('summarizing'), 2000);
      const verifyTimer = setTimeout(() => setStep('verifying'), 8000);
      const translateTimer = setTimeout(() => setStep('translating'), 14000);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceUrl', sourceUrl);

      const response = await fetch('/api/summarize', {
        method: 'POST',
        body: formData,
      });

      clearTimeout(progressTimer);
      clearTimeout(verifyTimer);
      clearTimeout(translateTimer);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to process document');
      }

      const result: UploadResult = await response.json();

      setStep('complete');
      onResult?.(result);
    } catch (err) {
      setStep('error');
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }

  function handleFileSelect(selected: File | null) {
    if (selected && selected.type !== 'application/pdf') {
      setError('Please select a PDF file.');
      return;
    }
    setError(null);
    setFile(selected);
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* File Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const dropped = e.dataTransfer.files[0];
          handleFileSelect(dropped || null);
        }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent, #b44d12)' : 'var(--border, #e2ddd4)'}`,
          borderRadius: '14px',
          padding: '40px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'var(--accent-glow, rgba(180,77,18,0.08))' : 'white',
          transition: 'all 0.2s',
          marginBottom: '20px',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>
          {file ? '\u2705' : '\u{1F4C4}'}
        </div>
        <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '4px' }}>
          {file ? file.name : 'Drop a government PDF here, or click to browse'}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted, #8a8a92)' }}>
          {file
            ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
            : 'Budgets, resolutions, meeting minutes, legislation (max 10 MB)'}
        </div>
      </div>

      {/* Source URL */}
      <div style={{ marginBottom: '20px' }}>
        <label
          htmlFor="sourceUrl"
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '8px',
          }}
        >
          Source URL
          <span style={{ color: 'var(--muted, #8a8a92)', fontWeight: 400, marginLeft: '8px' }}>
            Where is this document published?
          </span>
        </label>
        <input
          id="sourceUrl"
          type="url"
          required
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://cityname.gov/documents/budget-fy2026.pdf"
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '10px',
            border: '1px solid var(--border, #e2ddd4)',
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ fontSize: '12px', color: 'var(--muted, #8a8a92)', marginTop: '4px' }}>
          Every civic brief links back to the original government source for verification.
        </div>
      </div>

      {/* Pipeline Progress */}
      {step && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '10px',
            background:
              step === 'error'
                ? '#fee2e2'
                : step === 'complete'
                  ? 'var(--green-light, #e9f5ec)'
                  : 'var(--warm, #f5f0e8)',
            marginBottom: '20px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {isProcessing && (
            <div
              style={{
                width: '16px',
                height: '16px',
                border: '2px solid var(--accent, #b44d12)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}
          <span>{PIPELINE_LABELS[step]}</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: '#fee2e2',
            color: '#dc2626',
            fontSize: '14px',
            marginBottom: '20px',
          }}
        >
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!file || !sourceUrl || isProcessing}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: '10px',
          border: 'none',
          background:
            !file || !sourceUrl || isProcessing
              ? 'var(--muted, #8a8a92)'
              : 'var(--ink, #1b1b1f)',
          color: 'white',
          fontSize: '16px',
          fontWeight: 600,
          cursor: !file || !sourceUrl || isProcessing ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.2s',
        }}
      >
        {isProcessing ? 'Processing...' : 'Generate Civic Brief'}
      </button>
    </form>
  );
}
