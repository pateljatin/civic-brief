'use client';

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
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {LANGUAGES.filter((l) => available.includes(l.code)).map((lang) => (
        <button
          key={lang.code}
          onClick={() => onChange(lang.code)}
          disabled={loading && lang.code !== current}
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
