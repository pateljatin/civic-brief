'use client';

import { useRef } from 'react';

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Espanol' },
  { code: 'hi', name: 'Hindi', nativeName: 'Hindi' },
];

interface LanguageToggleProps {
  current: string;
  available: string[];
  onChange: (languageCode: string) => void;
  loading?: boolean;
}

export default function LanguageToggle({
  current,
  available,
  onChange,
  loading,
}: LanguageToggleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const filtered = LANGUAGES.filter((l) => available.includes(l.code));

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    if (!buttons || buttons.length === 0) return;
    const enabledList = Array.from(buttons);
    const currentIdx = enabledList.indexOf(e.currentTarget);
    if (currentIdx === -1) return;
    const nextIdx =
      e.key === 'ArrowRight'
        ? (currentIdx + 1) % enabledList.length
        : (currentIdx - 1 + enabledList.length) % enabledList.length;
    enabledList[nextIdx].focus();
  }

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Select language"
      style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}
    >
      {filtered.map((lang, index) => (
        <button
          key={lang.code}
          onClick={() => onChange(lang.code)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          disabled={loading && lang.code !== current}
          aria-pressed={lang.code === current}
          style={{
            padding: '6px 16px',
            borderRadius: '20px',
            border:
              lang.code === current
                ? '2px solid var(--ink, #1b1b1f)'
                : '1px solid var(--border, #e2ddd4)',
            background: lang.code === current ? 'var(--ink, #1b1b1f)' : 'white',
            color: lang.code === current ? 'white' : 'var(--muted, #8a8a92)',
            fontSize: '13px',
            fontWeight: lang.code === current ? 600 : 400,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading && lang.code !== current ? 0.5 : 1,
            transition: 'all 0.2s',
            fontFamily: 'inherit',
          }}
        >
          {lang.nativeName}
          {loading && lang.code === current && ' ...'}
        </button>
      ))}
    </div>
  );
}
