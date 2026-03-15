# CLAUDE.md — Civic Brief Project Handoff

## WHAT THIS IS

Civic Brief is a landing page and future open-source platform for a Mozilla Foundation Democracy x AI Incubator grant application. The initial proposal has been submitted. This repo needs to be deployed to Vercel ASAP so the URL can be added to the application.

## IMMEDIATE TASK

1. Initialize git repo (if not already done)
2. Ensure `index.html` is in the root of this folder
3. Create a GitHub repo called `civic-brief` and push
4. Deploy to Vercel
5. Return the live URL

### Step-by-step commands:

```bash
# If git not initialized yet
git init
git branch -M main

# Add the index.html file (should already be in this folder)
git add .
git commit -m "Civic Brief landing page — Mozilla Democracy x AI Incubator 2026"

# Create GitHub repo (using gh CLI if available)
gh repo create civic-brief --public --source=. --push

# If gh CLI not available, create repo manually on github.com then:
# git remote add origin https://github.com/YOUR_USERNAME/civic-brief.git
# git push -u origin main

# Deploy to Vercel
npx vercel --prod

# Or link to Vercel via their dashboard:
# 1. Go to vercel.com
# 2. Import the civic-brief repo
# 3. It auto-deploys
```

The live URL will be something like `civic-brief.vercel.app` or `civic-brief-USERNAME.vercel.app`.

## FILE STRUCTURE

```
civic-brief/
├── CLAUDE.md          (this file)
├── index.html         (the landing page — single file, no build step needed)
└── README.md          (create if needed)
```

This is a static HTML site. No framework, no build step, no npm install. Just `index.html` served as-is.

## PROJECT CONTEXT

**Project:** Civic Brief — Open Civic Intelligence
**Grant:** Mozilla Foundation Democracy x AI Incubator 2026 ($50K, 12 months)
**Founder:** Jatin Patel (Group Product Manager, Microsoft Teams)
**Status:** Initial proposal submitted March 16, 2026. Full proposal due April 15, 2026.

**What Civic Brief does:** An open-source platform that uses AI to turn government budgets, legislation, meetings, and policy documents into plain-language civic intelligence in the languages communities actually speak.

**Tech stack (for the actual platform, not this landing page):** Next.js 14, TypeScript, Supabase, Vercel, Claude API

**The landing page includes:**
- Hero with two-sided visual (government docs in → civic briefs out on phone)
- Crisis stats (3,500+ newspapers closed, 213 counties with zero news, 50M Americans affected)
- Pipeline visualization (Ingest → Interpret → Verify → Translate → Deliver)
- Five tabbed scenarios showing input documents and phone output:
  1. Budget Tracking (city budget → property tax explanation)
  2. School Board (resolution → plain-language contract summary)
  3. Zoning (planning amendment → "your block is affected" alert)
  4. Legislation (state bill → plain-language law explanation)
  5. Multilingual (Spanish LA County notice → Spanish civic brief with language toggle)
- Four-layer verification visual (Source Grounding → LLM-as-Judge → Community → User Feedback)
- Founder quote and credentials
- Open source badges (MIT, Next.js, TypeScript, Supabase, Claude API, Vercel)

## WRITING STYLE RULES (for any text changes)

- No AI jargon. No buzzwords.
- Never use: "AI-powered", "leverage" (as verb), "ecosystem", "seamless", "robust", "revolutionary", "transformative"
- Never use em-dashes (—). Use commas, periods, or semicolons instead.
- Oxford comma. US English.
- Write like a builder who has seen real problems and knows how to fix them.

## WHAT COMES NEXT (after tonight's deployment)

- [ ] Finalize project name (Civic Brief is working title — may change before April 15)
- [ ] Build working demo: upload a government PDF, get a plain-language civic summary in multiple languages
- [ ] Record 2-minute video for full proposal
- [ ] Create the actual Next.js app in this repo
- [ ] Full proposal submission by April 15, 2026
