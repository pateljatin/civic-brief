'use client';

import { useState, useEffect } from 'react';
import JurisdictionSearch from '@/components/JurisdictionSearch';
import ConfidenceScore from '@/components/ConfidenceScore';

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

interface BriefResult {
  brief_id: string;
  headline: string;
  source_url: string;
  document_type: string | null;
  language: string;
  jurisdiction_name: string;
  jurisdiction_level: string;
  jurisdiction_depth: number;
  confidence_score: number | null;
  relationship: string;
  created_at: string;
}

const LEVEL_COLORS: Record<string, { bg: string; color: string }> = {
  federal: { bg: 'var(--ink)', color: 'white' },
  state: { bg: 'var(--civic)', color: 'white' },
  county: { bg: 'var(--accent)', color: 'white' },
  city: { bg: 'var(--green)', color: 'white' },
};

const QUICK_PICKS = [
  { name: 'Seattle', id: '00000000-0000-0000-0000-000000000004' },
  { name: 'New York City', id: '00000000-0000-0000-0000-000000000022' },
  { name: 'Philadelphia', id: '00000000-0000-0000-0000-000000000020' },
];

export default function LocationPage() {
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [briefs, setBriefs] = useState<BriefResult[]>([]);
  const [loadingBriefs, setLoadingBriefs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) {
      setBriefs([]);
      return;
    }

    async function loadBriefs() {
      setLoadingBriefs(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/location?q=${encodeURIComponent(selected!.jurisdiction.name)}&limit=1`
        );
        if (!res.ok) throw new Error('Failed to load briefs');
        // For now, briefs come from a separate query -- placeholder until
        // briefs_for_location RPC is wired up on the client side
        setBriefs([]);
      } catch {
        setError('Failed to load briefs. Please try again.');
      } finally {
        setLoadingBriefs(false);
      }
    }

    loadBriefs();
  }, [selected]);

  function handleQuickPick(pick: { name: string; id: string }) {
    setSelected({
      jurisdiction: {
        id: pick.id,
        name: pick.name,
        slug: pick.name.toLowerCase().replace(/\s+/g, '-'),
        population: null,
        level_name: 'City',
        depth: 4,
      },
      hierarchy: [],
      brief_count: 0,
      similarity: null,
    });
  }

  // Group briefs by jurisdiction level
  const groupedBriefs = briefs.reduce<Record<string, BriefResult[]>>((acc, b) => {
    const key = `${b.jurisdiction_level}: ${b.jurisdiction_name}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {});

  // Sort groups by depth (federal first, city last)
  const sortedGroups = Object.entries(groupedBriefs).sort((a, b) => {
    const depthA = a[1][0]?.jurisdiction_depth ?? 0;
    const depthB = b[1][0]?.jurisdiction_depth ?? 0;
    return depthA - depthB;
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '80px 24px 120px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 'clamp(30px, 4vw, 44px)',
          fontWeight: 800,
          marginBottom: '12px',
        }}>
          What's happening in your community?
        </h1>
        <p style={{
          fontSize: '17px',
          color: 'var(--muted)',
          fontWeight: 300,
          maxWidth: '520px',
          margin: '0 auto 32px',
        }}>
          Search by city, county, or state to find civic briefs from every level of government that affects you.
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '24px' }}>
        <JurisdictionSearch
          onSelect={setSelected}
          selectedName={selected?.jurisdiction.name}
          onClear={() => setSelected(null)}
        />
      </div>

      {/* Quick Picks (only when no selection) */}
      {!selected && (
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '16px',
          }}>
            {QUICK_PICKS.map((pick) => (
              <button
                key={pick.id}
                onClick={() => handleQuickPick(pick)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '24px',
                  border: '1px solid var(--border)',
                  background: 'var(--warm)',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  transition: 'all 200ms',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'var(--civic-light)';
                  (e.target as HTMLButtonElement).style.color = 'var(--civic)';
                  (e.target as HTMLButtonElement).style.borderColor = 'var(--civic)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'var(--warm)';
                  (e.target as HTMLButtonElement).style.color = 'var(--muted)';
                  (e.target as HTMLButtonElement).style.borderColor = 'var(--border)';
                }}
              >
                {pick.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hierarchy Breadcrumb */}
      {selected && selected.hierarchy.length > 0 && (
        <nav
          aria-label="Jurisdiction hierarchy"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            fontSize: '14px',
            color: 'var(--muted)',
            marginBottom: '32px',
          }}
        >
          {selected.hierarchy.map((h, i) => (
            <span key={h.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {i > 0 && <span style={{ color: 'var(--border)' }}>&gt;</span>}
              <span style={{
                fontWeight: h.name === selected.jurisdiction.name ? 600 : 400,
                color: h.name === selected.jurisdiction.name ? 'var(--ink)' : 'var(--muted)',
              }}>
                {h.name}
              </span>
            </span>
          ))}
        </nav>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '16px 20px',
          background: '#fee2e2',
          color: '#dc2626',
          borderRadius: '12px',
          fontSize: '14px',
          marginBottom: '24px',
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loadingBriefs && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          Loading briefs...
        </div>
      )}

      {/* Brief Groups */}
      {selected && !loadingBriefs && sortedGroups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {sortedGroups.map(([groupName, groupBriefs]) => {
            const levelKey = groupBriefs[0]?.jurisdiction_level?.toLowerCase() ?? 'city';
            const levelStyle = LEVEL_COLORS[levelKey] ?? LEVEL_COLORS.city;

            return (
              <section key={groupName}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '16px',
                }}>
                  <span style={{
                    padding: '3px 12px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase' as const,
                    background: levelStyle.bg,
                    color: levelStyle.color,
                  }}>
                    {groupBriefs[0]?.jurisdiction_level}
                  </span>
                  <h2 style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: '20px',
                    fontWeight: 700,
                  }}>
                    {groupBriefs[0]?.jurisdiction_name}
                  </h2>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    {groupBriefs.length} {groupBriefs.length === 1 ? 'brief' : 'briefs'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {groupBriefs.map((brief, idx) => (
                    <a
                      key={brief.brief_id}
                      href={`/brief/${brief.brief_id}`}
                      className="scenario-card-link"
                      style={{
                        display: 'block',
                        padding: '20px 24px',
                        background: 'white',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        color: 'inherit',
                        opacity: 0,
                        animation: `slideUp 400ms ease-out ${idx * 50}ms forwards`,
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '16px',
                      }}>
                        <div style={{ flex: 1 }}>
                          {brief.document_type && (
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              letterSpacing: '0.5px',
                              textTransform: 'uppercase' as const,
                              color: 'var(--accent)',
                              marginBottom: '4px',
                              display: 'block',
                            }}>
                              {brief.document_type}
                            </span>
                          )}
                          <div style={{
                            fontFamily: "'Fraunces', serif",
                            fontSize: '16px',
                            fontWeight: 700,
                            lineHeight: 1.3,
                          }}>
                            {brief.headline}
                          </div>
                          <div style={{
                            fontSize: '13px',
                            color: 'var(--muted)',
                            marginTop: '4px',
                          }}>
                            {new Date(brief.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </div>
                        </div>
                        {brief.confidence_score !== null && (
                          <ConfidenceScore
                            score={Math.round(brief.confidence_score * 100)}
                            level={brief.confidence_score >= 0.8 ? 'high' : brief.confidence_score >= 0.6 ? 'medium' : 'low'}
                          />
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {selected && !loadingBriefs && sortedGroups.length === 0 && !error && (
        <div style={{
          textAlign: 'center',
          padding: '64px 24px',
          background: 'var(--warm)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'var(--civic-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: '28px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--civic)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <h2 style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '22px',
            fontWeight: 700,
            marginBottom: '8px',
          }}>
            No civic briefs for {selected.jurisdiction.name} yet.
          </h2>
          <p style={{
            fontSize: '15px',
            color: 'var(--muted)',
            marginBottom: '20px',
          }}>
            Be the first to contribute.
          </p>
          <a
            href="/upload"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 28px',
              borderRadius: '10px',
              background: 'var(--accent)',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              fontFamily: "'Outfit', sans-serif",
              textDecoration: 'none',
              transition: 'transform 200ms, box-shadow 200ms',
            }}
          >
            Upload a document
          </a>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes slideUp {
            from { opacity: 1; transform: none; }
            to { opacity: 1; transform: none; }
          }
        }
      `}</style>
    </div>
  );
}
