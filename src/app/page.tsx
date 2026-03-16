'use client';

import { useEffect, useRef, useState } from 'react';

// ── Scenario Data ──
const scenarios = {
  budget: {
    header: 'City Budget FY2026-27',
    doc: `DEPARTMENT OF FINANCE<br/>PROPOSED BUDGET FISCAL YEAR 2026-27<br/><br/>General Fund Revenues: <span class="hl">$142,800,000</span><br/>General Fund Expenditures: $148,200,000<br/><br/>Sec 4.2 Property Tax Levy:<br/>Current rate: 1.12 per $100 assessed<br/>Proposed rate: <span class="hl">1.21 per $100 assessed</span><br/>(8.2% increase over FY2025-26)<br/><br/>Allocation Changes:<br/>Public Works: +$4,100,000 (road repair)<br/>Education: +$2,300,000 (facilities)<br/>Public Safety: <span class="hl">-$890,000</span> (fleet defer)`,
    phone: `
      <div class="brief-item"><div class="brief-icon" style="background:#fef3e2;color:var(--accent);">$</div><div><div class="brief-label">Your Property Tax</div><div class="brief-val">Going up 8.2%. A $300K home pays ~$270 more/year.</div></div></div>
      <div class="brief-item"><div class="brief-icon" style="background:var(--green-light);color:var(--green);">&#8593;</div><div><div class="brief-label">Where It Goes</div><div class="brief-val">$4.1M to road repair. $2.3M to school buildings.</div></div></div>
      <div class="brief-item"><div class="brief-icon" style="background:#fee2e2;color:#dc2626;">&#8595;</div><div><div class="brief-label">What Got Cut</div><div class="brief-val">Police fleet replacement delayed. Saves $890K.</div></div></div>
      <div class="mini-chart"><div class="mini-bar" style="height:70%;background:var(--civic);border-radius:3px 3px 0 0;"></div><div class="mini-bar" style="height:85%;background:var(--civic);"></div><div class="mini-bar" style="height:100%;background:var(--accent);"></div></div>
      <div style="font-size:9px;color:var(--muted);text-align:center;margin-top:-4px;">FY24 &nbsp;&nbsp; FY25 &nbsp;&nbsp; FY26</div>
      <div class="brief-item" style="margin-top:10px;"><div class="brief-icon" style="background:var(--civic-light);color:var(--civic);">&#128197;</div><div><div class="brief-label">Comment By</div><div class="brief-val">April 12. Budget hearing: April 18, 7pm City Hall.</div></div></div>`,
  },
  school: {
    header: 'Board of Education Resolution 2026-0142',
    doc: `RESOLUTION NO. 2026-0142<br/><br/>WHEREAS, the Board of Education hereby authorizes execution of <span class="hl">Contract No. ED-2026-BUS-003</span> with TransitCo LLC for pupil transportation pursuant to RFP-2025-087, in an amount <span class="hl">not to exceed $2,400,000</span> for the period July 1, 2026 through June 30, 2029, superseding existing agreement with SafeRide Corp (<span class="hl">Contract ED-2023-BUS-001</span>)...<br/><br/>BE IT FURTHER RESOLVED that the Superintendent is authorized to execute all documents necessary...`,
    phone: `
      <div class="brief-item"><div class="brief-icon" style="background:#fef3e2;color:var(--accent);">&#916;</div><div><div class="brief-label">What Changed</div><div class="brief-val">New 3-year bus contract. TransitCo replaces SafeRide.</div></div></div>
      <div class="brief-item"><div class="brief-icon" style="background:var(--civic-light);color:var(--civic);">$</div><div><div class="brief-label">The Money</div><div class="brief-val">$2.4M total (was $1.8M). That is $800K/year.</div></div></div>
      <div class="brief-item"><div class="brief-icon" style="background:var(--green-light);color:var(--green);">&#10003;</div><div><div class="brief-label">What You Can Do</div><div class="brief-val">Public comment open until March 22. Next meeting April 3.</div></div></div>
      <div class="brief-item"><div class="brief-icon" style="background:#f3e8ff;color:#7c3aed;">&#9873;</div><div><div class="brief-label">Who Voted</div><div class="brief-val">Passed 5-2. Chen, Park, Okafor, Williams, Ruiz in favor.</div></div></div>`,
  },
  zoning: {
    header: 'Planning Commission Amendment 47-B',
    doc: `PLANNING COMMISSION<br/>ZONING AMENDMENT APPLICATION 47-B<br/><br/>Applicant: Greenfield Dev Corp<br/>Location: <span class="hl">400-600 Block Elm Street</span><br/><br/>Current: R-2 Residential<br/>Proposed: <span class="hl">MU-1 Mixed Use</span><br/><br/>Pursuant to Municipal Code 17.24.060, the Commission recommends approval subject to conditions including: height limit 45ft, ground-floor commercial req, <span class="hl">parking variance 17.28.040(b)</span>, setback modification...<br/><br/>Environmental review: Cat. Exemption per CEQA 15332`,
    phone: `
      <div class="brief-item"><div class="brief-icon" style="background:#fef3e2;color:var(--accent);">&#127968;</div><div><div class="brief-label">Your Block</div><div class="brief-val">Elm St (400-600) changing from residential to mixed-use.</div></div></div>
      <div class="brief-item"><div class="brief-icon" style="background:var(--civic-light);color:var(--civic);">&#128200;</div><div><div class="brief-label">What It Means</div><div class="brief-val">Shops and offices allowed on ground floor. Housing above. Max 45ft tall.</div></div></div>
      <div class="brief-item"><div class="brief-icon" style="background:#fee2e2;color:#dc2626;">&#9888;</div><div><div class="brief-label">Watch Out</div><div class="brief-val">Parking requirement reduced. May affect street parking.</div></div></div>
      <div class="brief-item"><div class="brief-icon" style="background:var(--green-light);color:var(--green);">&#128197;</div><div><div class="brief-label">Comment By</div><div class="brief-val">April 5. City Council vote: April 15.</div></div></div>`,
  },
  legislation: {
    header: 'State Senate Bill SB-1247',
    doc: `SENATE BILL No. 1247<br/><br/>AN ACT to amend Section 65852.2 of the Government Code, relating to <span class="hl">accessory dwelling units</span>.<br/><br/>SECTION 1. (a) Notwithstanding Section 65852.2, a local agency shall not impose <span class="hl">owner-occupancy requirements</span> as a condition of approval...<br/><br/>(b) The maximum allowable size shall be increased to <span class="hl">1,200 square feet</span>...<br/><br/>(c) Ministerial approval required within <span class="hl">60 days</span> of complete application...<br/><br/>SEC. 2. This act shall become operative January 1, 2027.`,
    phone: `
      <div class="brief-item"><div class="brief-icon" style="background:#fef3e2;color:var(--accent);">&#127970;</div><div><div class="brief-label">What It Does</div><div class="brief-val">Makes it easier to build backyard apartments (ADUs). Removes owner-occupancy rule.</div></div></div>
      <div class="brief-item"><div class="brief-icon" style="background:var(--civic-light);color:var(--civic);">&#128207;</div><div><div class="brief-label">Key Changes</div><div class="brief-val">Max size up to 1,200 sqft. Cities must approve within 60 days.</div></div></div>
      <div class="brief-item"><div class="brief-icon" style="background:var(--green-light);color:var(--green);">&#128100;</div><div><div class="brief-label">Who It Affects</div><div class="brief-val">Homeowners who want to build rental units. Renters seeking more housing options.</div></div></div>
      <div class="brief-item"><div class="brief-icon" style="background:#f3e8ff;color:#7c3aed;">&#128197;</div><div><div class="brief-label">When</div><div class="brief-val">Takes effect January 1, 2027 if signed by Governor.</div></div></div>`,
  },
  multilingual: {
    header: 'County of Los Angeles: Aviso de Audiencia P\u00fablica',
    doc: `CONDADO DE LOS ANGELES<br/>AVISO DE AUDIENCIA P\u00daBLICA<br/><br/>Por la presente se notifica que la Junta de Supervisores del Condado de Los Angeles llevar\u00e1 a cabo una <span class="hl">audiencia p\u00fablica el 22 de abril de 2026</span> a las 10:00 a.m. para considerar la adopci\u00f3n de una ordenanza que modifica el T\u00edtulo 22 del C\u00f3digo del Condado...<br/><br/>La ordenanza propuesta <span class="hl">aumentar\u00eda los l\u00edmites de densidad</span> en zonas R-3 y R-4 para permitir unidades adicionales de vivienda asequible...<br/><br/>Los comentarios escritos deben recibirse antes del <span class="hl">15 de abril de 2026</span>.<br/><br/>Also available in: English, Chinese, Korean, Vietnamese`,
    phone: `
      <div style="display:flex;gap:6px;margin-bottom:10px;"><div style="flex:1;text-align:center;padding:4px;border-radius:6px;background:var(--accent);color:white;font-size:10px;font-weight:600;">Espa\u00f1ol</div><div style="flex:1;text-align:center;padding:4px;border-radius:6px;border:1px solid var(--border);font-size:10px;font-weight:600;">English</div><div style="flex:1;text-align:center;padding:4px;border-radius:6px;border:1px solid var(--border);font-size:10px;font-weight:600;">\u4e2d\u6587</div></div>
      <div class="brief-item"><div class="brief-icon" style="background:#fef3e2;color:var(--accent);">&#127968;</div><div><div class="brief-label">Qu\u00e9 Cambia</div><div class="brief-val">M\u00e1s viviendas permitidas en zonas R-3 y R-4. Vivienda asequible.</div></div></div>
      <div class="brief-item"><div class="brief-icon" style="background:var(--civic-light);color:var(--civic);">&#128100;</div><div><div class="brief-label">A Qui\u00e9n Afecta</div><div class="brief-val">Inquilinos y propietarios en zonas R-3/R-4 del condado de LA.</div></div></div>
      <div class="brief-item"><div class="brief-icon" style="background:#fee2e2;color:#dc2626;">&#9200;</div><div><div class="brief-label">Fecha L\u00edmite</div><div class="brief-val">Comentarios antes del 15 de abril. Audiencia: 22 de abril, 10am.</div></div></div>
      <div class="brief-item"><div class="brief-icon" style="background:var(--green-light);color:var(--green);">&#10003;</div><div><div class="brief-label">Qu\u00e9 Puede Hacer</div><div class="brief-val">Enviar comentarios escritos o asistir a la audiencia p\u00fablica.</div></div></div>`,
  },
} as const;

type ScenarioKey = keyof typeof scenarios;

const tabLabels: { key: ScenarioKey; icon: string; label: string }[] = [
  { key: 'budget', icon: '\u{1F4C8}', label: 'Budget Tracking' },
  { key: 'school', icon: '\u{1F3EB}', label: 'School Board' },
  { key: 'zoning', icon: '\u{1F3D7}', label: 'Zoning' },
  { key: 'legislation', icon: '\u{1F4DC}', label: 'Legislation' },
  { key: 'multilingual', icon: '\u{1F310}', label: 'Multilingual (ES/HI/+)' },
];

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<ScenarioKey>('budget');
  const [tabVisible, setTabVisible] = useState(true);
  const revealRefs = useRef<HTMLElement[]>([]);

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('visible');
        });
      },
      { threshold: 0.12 }
    );
    revealRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function addRevealRef(el: HTMLElement | null) {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el);
    }
  }

  function switchTab(key: ScenarioKey) {
    if (key === activeTab) return;
    setTabVisible(false);
    setTimeout(() => {
      setActiveTab(key);
      setTabVisible(true);
    }, 300);
  }

  const current = scenarios[activeTab];

  return (
    <>
      <style>{landingStyles}</style>

      {/* HERO */}
      <section className="l-hero">
        <div className="l-hero-left">
          <div className="l-hero-eyebrow">Open Source Civic Intelligence</div>
          <h1>
            Your government,
            <br />
            in <em>your language,</em>
            <br />
            in plain language.
          </h1>
          <p className="l-tagline">
            Government documents go in. Plain-language civic briefs come out.
            In the languages your community actually speaks.
          </p>
          <a href="/upload" className="l-hero-cta">
            Try it now &#8594;
          </a>
        </div>
        <div className="l-hero-right">
          <div className="l-hero-visual">
            <div className="l-doc-stack">
              <div className="l-doc-page" style={{ animationDelay: '1s' }}>
                <div className="l-doc-page-header">City Budget FY2026</div>
                <div className="l-doc-line" /><div className="l-doc-line l-med" /><div className="l-doc-line-hl" /><div className="l-doc-line l-short" /><div className="l-doc-line" /><div className="l-doc-line l-med" />
              </div>
              <div className="l-doc-page" style={{ animationDelay: '1.2s' }}>
                <div className="l-doc-page-header">Resolution No. 2026-0142</div>
                <div className="l-doc-line" /><div className="l-doc-line" /><div className="l-doc-line l-short" /><div className="l-doc-line-hl" /><div className="l-doc-line l-med" />
              </div>
              <div className="l-doc-page" style={{ animationDelay: '1.4s' }}>
                <div className="l-doc-page-header">Zoning Amendment 47-B</div>
                <div className="l-doc-line l-med" /><div className="l-doc-line" /><div className="l-doc-line-hl" /><div className="l-doc-line" /><div className="l-doc-line l-short" />
              </div>
            </div>
            <div className="l-flow-arrow">
              <svg viewBox="0 0 60 40" fill="none" width="60" height="40"><path d="M4 20h44m0 0l-12-10m12 10l-12 10" stroke="#b44d12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div className="l-phone-hero">
              <div className="l-phone">
                <div className="l-phone-notch" />
                <div className="l-phone-screen">
                  <div className="l-phone-top">
                    <div className="l-phone-top-title">Civic Brief</div>
                    <div className="l-phone-top-dot" />
                  </div>
                  <div className="l-pcard" style={{ animationDelay: '1.4s' }}>
                    <div className="l-pcard-tag l-t-budget">Budget</div>
                    <div className="l-pcard-title">Property Tax Up 8.2%</div>
                    <div className="l-pcard-body">$4.1M increase allocated to road repair and school facilities.</div>
                  </div>
                  <div className="l-pcard" style={{ animationDelay: '1.7s' }}>
                    <div className="l-pcard-tag l-t-zone">Zoning</div>
                    <div className="l-pcard-title">Elm St Rezoned Mixed-Use</div>
                    <div className="l-pcard-body">Blocks 400-600. Approved 4-1. Comment deadline: April 5.</div>
                  </div>
                  <div className="l-pcard" style={{ animationDelay: '2s' }}>
                    <div className="l-pcard-tag l-t-policy">Policy</div>
                    <div className="l-pcard-title">New Farm Subsidy Scheme</div>
                    <div className="l-pcard-body">Farms under 5ha eligible. Apply by May 1.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="l-stats">
        <div className="l-stats-inner">
          <div><div className="l-stat-num">3,500+</div><div className="l-stat-label">newspapers closed in 20 years</div></div>
          <div><div className="l-stat-num">213</div><div className="l-stat-label">US counties, zero local news</div></div>
          <div><div className="l-stat-num">50M</div><div className="l-stat-label">Americans with limited civic access</div></div>
          <div><div className="l-stat-num">4B+</div><div className="l-stat-label">citizens in non-dominant languages</div></div>
        </div>
      </div>

      {/* SCENARIOS */}
      <section className="l-scenarios" id="scenarios">
        <div className="l-scenarios-inner">
          <h2>Five scenarios. One platform.</h2>
          <p className="l-sub">Click each tab to see both sides: what goes in, and what comes out.</p>
          <div className="l-tab-bar">
            {tabLabels.map((t) => (
              <button
                key={t.key}
                className={`l-tab-btn ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => switchTab(t.key)}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div className="l-tab-content">
            <div className={`l-tab-doc ${tabVisible ? 'show' : ''}`}>
              <div className="l-tab-doc-header">{current.header}</div>
              <div className="l-tab-doc-body" dangerouslySetInnerHTML={{ __html: current.doc }} />
            </div>
            <div className="l-tab-arrow">
              <div className="l-tab-arrow-label">AI</div>
              <div className="l-tab-arrow-line" />
              <div className="l-tab-arrow-icon">&#10132;</div>
              <div className="l-tab-arrow-line" />
            </div>
            <div className={`l-tab-phone-wrap ${tabVisible ? 'show' : ''}`}>
              <div className="l-phone-sm">
                <div className="l-phone-sm-notch" />
                <div className="l-phone-sm-screen">
                  <div className="l-phone-sm-header">Civic Brief</div>
                  <div dangerouslySetInnerHTML={{ __html: current.phone }} />
                  <div className="l-share-row">
                    <div className="l-share-btn l-share-wa">&#128172; WhatsApp</div>
                    <div className="l-share-btn l-share-link">&#128279; Copy Link</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PIPELINE */}
      <section className="l-pipeline reveal" ref={addRevealRef}>
        <h2>How it works</h2>
        <p className="l-sub">From bureaucratic PDF to civic clarity in minutes.</p>
        <div className="l-pipe-flow">
          {[
            { icon: '\u{1F4C4}', bg: '#fef3e2', title: 'Ingest', desc: 'Monitors government feeds for new budgets, legislation, meeting minutes, and public notices.' },
            { icon: '\u{1F9E0}', bg: '#f3e8ff', title: 'Interpret', desc: 'AI with civic-context prompting: what changed, who is affected, where the money goes.' },
            { icon: '\u2705', bg: 'var(--green-light)', title: 'Verify', desc: 'LLM-as-Judge scores accuracy. Low-confidence outputs routed to community reviewers.' },
            { icon: '\u{1F310}', bg: 'var(--civic-light)', title: 'Translate', desc: 'Simultaneous output in English, Spanish, Hindi, Hausa, and any community language.' },
            { icon: '\u{1F4F1}', bg: '#fce7f3', title: 'Deliver', desc: 'Mobile portal, WhatsApp, newsletters, embeddable widgets. Where people already are.' },
          ].map((step) => (
            <div key={step.title} className="l-pipe-step">
              <div className="l-pipe-icon" style={{ background: step.bg }}>{step.icon}</div>
              <div className="l-pipe-title">{step.title}</div>
              <div className="l-pipe-desc">{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* VERIFICATION */}
      <div className="l-verify-wrap">
        <section className="l-verify reveal" ref={addRevealRef}>
          <h2>AI that earns civic trust</h2>
          <p className="l-sub">Getting civic information wrong is not a quality issue. It is a democratic harm. Four layers of verification.</p>
          <div className="l-verify-grid">
            {[
              { num: 1, title: 'Source Grounding', desc: 'Every summary generated solely from the source document. No general AI knowledge for civic claims. Auditable.' },
              { num: 2, title: 'LLM-as-Judge', desc: 'Separate AI model scores factuality against source. Below threshold? Flagged for human review before publication.' },
              { num: 3, title: 'Community Review', desc: 'Civil society partners and local experts verify flagged summaries. Every correction improves future output.' },
              { num: 4, title: 'User Feedback', desc: 'Citizens flag errors directly. Patterns of error inform systemic improvements to civic prompting.' },
            ].map((card) => (
              <div key={card.num} className="l-verify-card">
                <div className="l-verify-num">{card.num}</div>
                <div className="l-verify-title">{card.title}</div>
                <div className="l-verify-desc">{card.desc}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* QUOTE */}
      <section className="l-quote reveal" ref={addRevealRef}>
        <div className="l-quote-text">
          &ldquo;Transparency is not a luxury. It is the minimum requirement for democratic participation.&rdquo;
        </div>
        <div className="l-quote-attr">
          <strong>Jatin Patel</strong>, Founder &middot; 20+ years &middot; Group PM, Microsoft Teams &middot; Built PeopleBuilt.ai solo
        </div>
      </section>

      {/* OPEN SOURCE */}
      <section className="l-open">
        <h2>Open by design. Day one.</h2>
        <p>Every line of code, every civic summary, every document processed. Public, auditable, deployable by any community, anywhere.</p>
        <div className="l-open-badges">
          {['MIT License', 'Next.js 16', 'TypeScript', 'Supabase', 'Claude API', 'Vercel'].map((badge) => (
            <div key={badge} className="l-open-badge">{badge}</div>
          ))}
        </div>
      </section>

    </>
  );
}

// ── Scoped styles for landing page ──
const landingStyles = `
  .hl{background:rgba(180,77,18,0.1);border-bottom:2px solid var(--accent);padding:0 2px;}

  .l-hero{min-height:100vh;display:flex;align-items:center;padding:120px 40px 80px;max-width:1280px;margin:0 auto;}
  .l-hero-left{flex:1;max-width:560px;}
  .l-hero-right{flex:1;display:flex;justify-content:center;align-items:center;position:relative;}
  .l-hero-eyebrow{font-size:12px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:var(--accent);margin-bottom:24px;animation:fadeUp 0.6s 0.2s both;}
  .l-hero h1{font-family:'Fraunces',serif;font-size:clamp(38px,5vw,58px);font-weight:800;line-height:1.08;margin-bottom:24px;animation:fadeUp 0.6s 0.4s both;}
  .l-hero h1 em{font-style:italic;color:var(--accent);}
  .l-tagline{font-size:18px;color:var(--muted);font-weight:300;max-width:460px;margin-bottom:40px;animation:fadeUp 0.6s 0.6s both;}
  .l-hero-cta{display:inline-flex;align-items:center;gap:10px;background:var(--ink);color:var(--paper);padding:16px 32px;border-radius:10px;font-weight:600;font-size:15px;text-decoration:none;transition:all 0.3s;animation:fadeUp 0.6s 0.8s both;border:none;cursor:pointer;}
  .l-hero-cta:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(0,0,0,0.18);}
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}

  .l-hero-visual{position:relative;width:100%;max-width:520px;height:500px;}
  .l-doc-stack{position:absolute;left:-20px;top:40px;width:200px;z-index:1;}
  .l-doc-page{background:white;border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:-140px;box-shadow:0 2px 12px rgba(0,0,0,0.06);opacity:0;animation:docFloat 0.8s forwards;}
  .l-doc-page:nth-child(1){transform:rotate(-6deg);}
  .l-doc-page:nth-child(2){transform:rotate(-2deg);}
  .l-doc-page:nth-child(3){transform:rotate(-5deg);}
  @keyframes docFloat{to{opacity:0.7;}}
  .l-doc-page-header{font-size:7px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--civic);margin-bottom:6px;border-bottom:1px solid var(--border);padding-bottom:4px;}
  .l-doc-line{height:4px;background:var(--border);border-radius:2px;margin-bottom:4px;width:100%;}
  .l-short{width:60%;}.l-med{width:80%;}
  .l-doc-line-hl{height:4px;background:var(--accent-glow);border-radius:2px;margin-bottom:4px;width:70%;border:1px solid rgba(180,77,18,0.2);}

  .l-flow-arrow{position:absolute;left:170px;top:200px;z-index:2;opacity:0;animation:arrowPulse 2s 1.6s infinite;}
  @keyframes arrowPulse{0%,100%{opacity:0.3;transform:translateX(0);}50%{opacity:1;transform:translateX(8px);}}

  .l-phone-hero{position:absolute;right:0;top:10px;z-index:3;opacity:0;animation:phoneSlide 0.8s 1s forwards;}
  @keyframes phoneSlide{from{opacity:0;transform:translateX(40px);}to{opacity:1;transform:translateX(0);}}
  .l-phone{width:260px;height:520px;background:#fff;border-radius:32px;border:5px solid var(--ink);overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.12),0 4px 12px rgba(0,0,0,0.06);position:relative;}
  .l-phone-notch{width:90px;height:22px;background:var(--ink);border-radius:0 0 14px 14px;margin:0 auto;}
  .l-phone-screen{padding:6px 14px 14px;height:calc(100% - 22px);overflow:hidden;background:#fafafa;}
  .l-phone-top{display:flex;justify-content:space-between;align-items:center;padding:10px 0 8px;border-bottom:1px solid #eee;margin-bottom:10px;}
  .l-phone-top-title{font-family:'Fraunces',serif;font-size:15px;font-weight:700;}
  .l-phone-top-dot{width:8px;height:8px;background:var(--green);border-radius:50%;}

  .l-pcard{background:#fff;border:1px solid #eee;border-radius:10px;padding:10px 12px;margin-bottom:7px;opacity:0;animation:pcardIn 0.4s forwards;}
  @keyframes pcardIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
  .l-pcard-tag{display:inline-block;font-size:8px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;padding:2px 7px;border-radius:3px;margin-bottom:5px;}
  .l-t-budget{background:#fef3e2;color:var(--accent);}
  .l-t-zone{background:var(--civic-light);color:var(--civic);}
  .l-t-policy{background:var(--green-light);color:var(--green);}
  .l-pcard-title{font-weight:600;font-size:12px;line-height:1.3;margin-bottom:3px;}
  .l-pcard-body{font-size:10px;color:var(--muted);line-height:1.5;}

  .l-stats{background:var(--ink);padding:56px 40px;}
  .l-stats-inner{max-width:1280px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:24px;text-align:center;}
  .l-stat-num{font-family:'Fraunces',serif;font-size:clamp(32px,4vw,48px);font-weight:800;color:#fff;}
  .l-stat-label{font-size:13px;color:rgba(255,255,255,0.45);font-weight:300;margin-top:4px;}

  .l-scenarios{background:var(--warm);padding:100px 40px;}
  .l-scenarios-inner{max-width:1280px;margin:0 auto;}
  .l-scenarios h2{font-family:'Fraunces',serif;font-size:clamp(30px,4vw,44px);font-weight:800;text-align:center;margin-bottom:12px;}
  .l-sub{text-align:center;color:var(--muted);font-weight:300;font-size:18px;max-width:520px;margin:0 auto 48px;}
  .l-tab-bar{display:flex;justify-content:center;gap:6px;margin-bottom:48px;flex-wrap:wrap;}
  .l-tab-btn{padding:10px 22px;border-radius:24px;border:1px solid var(--border);background:white;font-family:'Outfit',sans-serif;font-size:14px;font-weight:500;cursor:pointer;transition:all 0.3s;color:var(--muted);}
  .l-tab-btn:hover{border-color:var(--accent);color:var(--accent);}
  .l-tab-btn.active{background:var(--ink);color:white;border-color:var(--ink);}

  .l-tab-content{display:grid;grid-template-columns:1fr 100px 1fr;align-items:center;gap:0;max-width:960px;margin:0 auto;}
  .l-tab-doc{background:white;border:1px solid var(--border);border-radius:14px;padding:0;overflow:hidden;opacity:0;transform:translateX(-20px);transition:all 0.5s;}
  .l-tab-doc.show{opacity:1;transform:translateX(0);}
  .l-tab-doc-header{background:var(--civic);color:white;padding:10px 18px;font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;}
  .l-tab-doc-body{padding:20px;font-family:'Courier New',monospace;font-size:11px;color:var(--muted);line-height:1.8;}

  .l-tab-arrow{display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--accent);}
  .l-tab-arrow-line{width:2px;height:40px;background:linear-gradient(to bottom,var(--border),var(--accent));}
  .l-tab-arrow-icon{font-size:20px;animation:arrowBounce 1.5s infinite;}
  @keyframes arrowBounce{0%,100%{transform:translateX(0);}50%{transform:translateX(6px);}}
  .l-tab-arrow-label{font-size:9px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--accent);writing-mode:vertical-rl;text-orientation:mixed;}
  .l-tab-phone-wrap{display:flex;justify-content:center;opacity:0;transform:translateX(20px);transition:all 0.5s 0.2s;}
  .l-tab-phone-wrap.show{opacity:1;transform:translateX(0);}

  .l-phone-sm{width:220px;background:#fff;border-radius:28px;border:4px solid var(--ink);overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,0.1);}
  .l-phone-sm-notch{width:70px;height:18px;background:var(--ink);border-radius:0 0 12px 12px;margin:0 auto;}
  .l-phone-sm-screen{padding:8px 12px 14px;}
  .l-phone-sm-header{font-family:'Fraunces',serif;font-size:12px;font-weight:700;text-align:center;padding:8px 0 6px;border-bottom:1px solid #eee;margin-bottom:8px;}

  .brief-item{display:flex;gap:8px;margin-bottom:10px;align-items:flex-start;}
  .brief-icon{width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;}
  .brief-label{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);}
  .brief-val{font-size:12px;font-weight:500;line-height:1.4;margin-top:1px;}
  .mini-chart{display:flex;align-items:flex-end;gap:4px;height:50px;padding:8px 0;}
  .mini-bar{flex:1;border-radius:3px 3px 0 0;transition:height 0.5s;}
  .l-share-row{display:flex;gap:6px;margin-top:8px;}
  .l-share-btn{flex:1;text-align:center;padding:6px;border-radius:6px;font-size:9px;font-weight:600;border:1px solid #eee;}
  .l-share-wa{background:#25D366;color:white;border-color:#25D366;}
  .l-share-link{background:white;color:var(--ink);}

  .l-pipeline{max-width:1280px;margin:0 auto;padding:100px 40px;}
  .l-pipeline h2{font-family:'Fraunces',serif;font-size:clamp(30px,4vw,44px);font-weight:800;text-align:center;margin-bottom:12px;}
  .l-pipe-flow{display:flex;align-items:stretch;gap:0;position:relative;}
  .l-pipe-step{flex:1;text-align:center;padding:32px 20px;position:relative;}
  .l-pipe-step::after{content:'';position:absolute;right:-1px;top:50%;width:32px;height:2px;background:var(--border);z-index:1;}
  .l-pipe-step:last-child::after{display:none;}
  .l-pipe-icon{width:56px;height:56px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;margin:0 auto 14px;transition:transform 0.3s;}
  .l-pipe-step:hover .l-pipe-icon{transform:scale(1.1);}
  .l-pipe-title{font-weight:600;font-size:15px;margin-bottom:6px;}
  .l-pipe-desc{font-size:13px;color:var(--muted);font-weight:300;line-height:1.6;}

  .l-verify-wrap{background:var(--warm);}
  .l-verify{max-width:1280px;margin:0 auto;padding:100px 40px;}
  .l-verify h2{font-family:'Fraunces',serif;font-size:clamp(30px,4vw,44px);font-weight:800;text-align:center;margin-bottom:12px;}
  .l-verify-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;}
  .l-verify-card{text-align:center;padding:28px 20px;background:white;border:1px solid var(--border);border-radius:12px;transition:all 0.3s;position:relative;}
  .l-verify-card:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(0,0,0,0.06);}
  .l-verify-card::after{content:'';position:absolute;right:-12px;top:50%;width:24px;height:2px;background:var(--border);}
  .l-verify-card:last-child::after{display:none;}
  .l-verify-num{font-family:'Fraunces',serif;font-size:28px;font-weight:800;color:var(--accent);margin-bottom:8px;}
  .l-verify-title{font-weight:600;font-size:14px;margin-bottom:6px;}
  .l-verify-desc{font-size:12px;color:var(--muted);font-weight:300;line-height:1.6;}

  .l-quote{padding:100px 40px;text-align:center;max-width:800px;margin:0 auto;}
  .l-quote-text{font-family:'Fraunces',serif;font-size:clamp(22px,3.5vw,34px);font-weight:400;font-style:italic;line-height:1.45;margin-bottom:24px;}
  .l-quote-attr{font-size:15px;color:var(--muted);}
  .l-quote-attr strong{color:var(--ink);font-weight:600;}

  .l-open{background:var(--ink);color:white;padding:80px 40px;text-align:center;}
  .l-open h2{font-family:'Fraunces',serif;font-size:34px;font-weight:800;margin-bottom:14px;}
  .l-open p{font-size:17px;font-weight:300;color:rgba(255,255,255,0.55);max-width:560px;margin:0 auto 28px;}
  .l-open-badges{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;}
  .l-open-badge{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);padding:8px 18px;border-radius:8px;font-size:13px;font-weight:500;}

  .reveal{opacity:0;transform:translateY(30px);transition:opacity 0.7s,transform 0.7s;}
  .reveal.visible{opacity:1;transform:translateY(0);}

  @media(max-width:900px){
    .l-hero{flex-direction:column;text-align:center;padding:120px 24px 60px;min-height:auto;}
    .l-hero-left{max-width:100%;}
    .l-tagline{margin:0 auto 40px;}
    .l-hero-visual{width:100%;max-width:400px;height:400px;margin:0 auto;}
    .l-doc-stack{display:none;}
    .l-flow-arrow{display:none;}
    .l-phone-hero{position:relative;right:auto;top:auto;margin:0 auto;}
    .l-stats-inner{grid-template-columns:repeat(2,1fr);}
    .l-pipe-flow{flex-direction:column;gap:24px;}
    .l-pipe-step::after{display:none;}
    .l-tab-content{grid-template-columns:1fr;gap:20px;}
    .l-tab-arrow{flex-direction:row;justify-content:center;padding:12px 0;}
    .l-tab-arrow-line{width:40px;height:2px;}
    .l-tab-arrow-label{writing-mode:horizontal-tb;}
    .l-verify-grid{grid-template-columns:repeat(2,1fr);}
    .l-verify-card::after{display:none;}
  }
  @media(max-width:480px){
    .l-stats-inner{grid-template-columns:1fr 1fr;gap:16px;}
    .l-tab-bar{gap:4px;}
    .l-tab-btn{padding:8px 14px;font-size:12px;}
    .l-verify-grid{grid-template-columns:1fr;}
  }
`;
