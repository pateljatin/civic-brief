'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface SearchResult {
  jurisdiction: {
    id: string;
    name: string;
    slug: string;
    population: number | null;
    level_name: string | null;
    depth: number | null;
  };
  hierarchy: { name: string; level_name: string; depth: number }[];
  brief_count: number;
  similarity: number | null;
}

interface JurisdictionSearchProps {
  onSelect: (result: SearchResult) => void;
  selectedName?: string;
  onClear?: () => void;
}

const LEVEL_COLORS: Record<string, { bg: string; color: string }> = {
  federal: { bg: 'var(--ink)', color: 'white' },
  state: { bg: 'var(--civic)', color: 'white' },
  county: { bg: 'var(--accent)', color: 'white' },
  city: { bg: 'var(--green)', color: 'white' },
};

function getLevelStyle(levelName: string | null) {
  if (!levelName) return LEVEL_COLORS.city;
  const key = levelName.toLowerCase();
  return LEVEL_COLORS[key] ?? LEVEL_COLORS.city;
}

export default function JurisdictionSearch({ onSelect, selectedName, onClear }: JurisdictionSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/location?q=${encodeURIComponent(q.trim())}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInputChange(value: string) {
    setQuery(value);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  }

  function handleSelect(result: SearchResult) {
    setOpen(false);
    setQuery('');
    setResults([]);
    onSelect(result);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (inputRef.current && !inputRef.current.parentElement?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // If a jurisdiction is selected, show compact view
  if (selectedName) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 20px',
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        fontSize: '16px',
        fontWeight: 500,
      }}>
        <span style={{ flex: 1 }}>{selectedName}</span>
        <button
          onClick={onClear}
          aria-label="Clear selection"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            color: 'var(--muted)',
            padding: '4px 8px',
            borderRadius: '6px',
            transition: 'color 200ms',
          }}
        >
          x
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <label htmlFor="jurisdiction-search" className="sr-only">
        Search jurisdictions
      </label>
      <input
        ref={inputRef}
        id="jurisdiction-search"
        type="text"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Seattle, King County, Washington..."
        role="combobox"
        aria-expanded={open}
        aria-controls="jurisdiction-results"
        aria-activedescendant={activeIndex >= 0 ? `jurisdiction-option-${activeIndex}` : undefined}
        autoComplete="off"
        style={{
          width: '100%',
          height: '48px',
          padding: '0 20px',
          fontSize: '16px',
          fontFamily: "'Outfit', sans-serif",
          border: '1px solid var(--border)',
          borderRadius: '12px',
          background: 'white',
          color: 'var(--ink)',
          outline: 'none',
          transition: 'border-color 200ms, box-shadow 200ms',
        }}
        onFocusCapture={(e) => {
          (e.target as HTMLInputElement).style.borderColor = 'var(--accent)';
          (e.target as HTMLInputElement).style.boxShadow = '0 0 0 2px var(--accent-glow)';
        }}
        onBlurCapture={(e) => {
          (e.target as HTMLInputElement).style.borderColor = 'var(--border)';
          (e.target as HTMLInputElement).style.boxShadow = 'none';
        }}
      />

      {loading && (
        <div style={{
          position: 'absolute',
          right: '16px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '13px',
          color: 'var(--muted)',
        }}>
          Searching...
        </div>
      )}

      {open && results.length > 0 && (
        <ul
          ref={listRef}
          id="jurisdiction-results"
          role="listbox"
          style={{
            position: 'absolute',
            top: '56px',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.1)',
            maxHeight: '360px',
            overflow: 'auto',
            zIndex: 50,
            listStyle: 'none',
            padding: '6px',
            margin: 0,
          }}
        >
          {results.map((r, i) => {
            const levelStyle = getLevelStyle(r.jurisdiction.level_name);
            const isActive = i === activeIndex;
            const breadcrumb = r.hierarchy
              .filter((h) => h.name !== r.jurisdiction.name)
              .map((h) => h.name)
              .join(' > ');

            return (
              <li
                key={r.jurisdiction.id}
                id={`jurisdiction-option-${i}`}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(r)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: isActive ? 'var(--warm)' : 'transparent',
                  transition: 'background 150ms',
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span
                  aria-label={r.jurisdiction.level_name ?? 'jurisdiction'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    background: levelStyle.bg,
                    color: levelStyle.color,
                    flexShrink: 0,
                  }}
                >
                  {r.jurisdiction.level_name ?? 'Other'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>
                    {r.jurisdiction.name}
                  </div>
                  {breadcrumb && (
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                      {breadcrumb}
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: '12px',
                  color: 'var(--muted)',
                  fontWeight: 500,
                  flexShrink: 0,
                }}>
                  {r.brief_count} {r.brief_count === 1 ? 'brief' : 'briefs'}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {open && results.length === 0 && !loading && query.trim().length >= 2 && (
        <div style={{
          position: 'absolute',
          top: '56px',
          left: 0,
          right: 0,
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.1)',
          padding: '20px',
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: '14px',
          zIndex: 50,
        }}>
          No jurisdictions found. Try a different name.
        </div>
      )}

      <style>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }
      `}</style>
    </div>
  );
}
