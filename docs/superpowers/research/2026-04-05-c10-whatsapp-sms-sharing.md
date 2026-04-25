# C10 WhatsApp/SMS Sharing: Research Report

**Date:** 2026-04-05
**Status:** Research complete, ready for spec writing

---

## Recommendation Summary

| Channel | Mechanism | Cost | Server-side? | PII? |
|---------|-----------|------|-------------|------|
| Primary (mobile) | Web Share API | $0 | No | None |
| WhatsApp (desktop fallback) | wa.me Click-to-Chat | $0 | No | None |
| SMS (desktop fallback) | sms:?body= URI | $0 | No | None |
| Copy Link (universal fallback) | navigator.clipboard | $0 | No | None |

**No new environment variables. No paid APIs. No privacy changes.**

---

## 1. WhatsApp Sharing

### Business API -- REJECTED
Overkill. Designed for businesses sending messages *to* users. Requires Meta Business verification, BSP, template approval. Wrong tool for user-initiated sharing.

### Click-to-Chat (wa.me) -- RECOMMENDED as desktop fallback
- URL: `https://wa.me/?text=URL_ENCODED_TEXT`
- Free, no API key, no account
- On mobile: opens WhatsApp app. On desktop: opens WhatsApp Web
- User picks contact and taps send (privacy-preserving)
- 65K char limit (not a concern)

---

## 2. SMS Sharing

### Server-side SMS (Twilio, MessageBird) -- REJECTED
Requires collecting phone numbers = PII. Violates privacy posture.

### sms: URI scheme -- RECOMMENDED
- Format: `sms:?body=URL_ENCODED_TEXT`
- Free. User's own SMS plan handles delivery
- Works on iOS, Android, most desktop SMS clients
- 160-char SMS segment limit (see URL shortening below)

---

## 3. Web Share API -- PRIMARY mechanism

```javascript
navigator.share({ title, text, url });
```

- Browser shows native share sheet (WhatsApp, SMS, email, etc.)
- ~95% mobile browser support, ~75% desktop (Firefox desktop is the gap)
- Feature detection: `if (navigator.share)`
- Must be called from `'use client'` component (CivicBrief already is)
- Fallback: copy to clipboard + explicit wa.me and sms: links

---

## 4. Open Graph / Social Previews -- CRITICAL GAP

### Current state
- Layout.tsx has basic `og:title` and `og:description` only
- **No `og:image`** -- shared links show blank preview in WhatsApp/iMessage
- `/brief/[id]` has **no generateMetadata** -- all briefs share generic metadata
- `/showcase/[scenario]` has generateMetadata but no image

### What's needed
- `og:image` (1200x630px) -- single biggest factor for click-through on shared links
- Per-brief `generateMetadata` in `/brief/[id]/page.tsx`
- Add `og:site_name`, `og:url`, `twitter:card` fields

### Dynamic OG images (free, built-in to Next.js)
- `src/app/brief/[id]/opengraph-image.tsx` -- branded image with headline, jurisdiction, confidence
- `src/app/showcase/[scenario]/opengraph-image.tsx` -- image with scenario title and icon
- Uses `next/og` (Satori + Resvg), server-rendered, cached

---

## 5. URL Shortening

### The problem
Brief URLs are 74 chars (`civic-brief.vercel.app/brief/UUID`), eating half an SMS segment.

### Recommendation: self-hosted short codes
- Add `short_code` column to `briefs` table (8-char nanoid, unique index)
- Create `/b/[code]` route that 302-redirects to `/brief/[id]`
- Result: `civic-brief.vercel.app/b/Xk9mR2pQ` (47 chars)
- Zero external dependencies

---

## 6. Where Share Buttons Go

### New component: `ShareButtons.tsx`
Props: `briefUrl`, `headline`, `whatChanged`, `lang`

### Integration points
- **`CivicBrief.tsx` footer** (primary) -- between source link and feedback section
- **`ScenarioHero.tsx`** -- next to "View original document" link
- **`upload/page.tsx`** -- replace raw "Shareable link" text

### Note
Homepage already has decorative WhatsApp/Copy mockup buttons in the phone preview (page.tsx lines 218-221). These are non-functional. Update to match real component design.

---

## 7. Privacy -- Fully Compatible

All mechanisms are client-side. We never see recipients, phone numbers, or sharing outcomes.

**Do NOT add:**
- Share count tracking
- UTM parameters on shared URLs
- External shortener analytics

**No CSP changes needed.** Web Share API is browser-native, wa.me/sms: are navigations.

---

## Files to Create
- `src/components/ShareButtons.tsx`
- `src/app/brief/[id]/opengraph-image.tsx`
- `src/app/showcase/[scenario]/opengraph-image.tsx`
- `src/app/b/[code]/route.ts` (short URL redirect)

## Files to Modify
- `src/components/CivicBrief.tsx` -- add ShareButtons
- `src/components/ScenarioHero.tsx` -- add ShareButtons
- `src/app/brief/[id]/page.tsx` -- add generateMetadata with per-brief OG tags
- `src/app/showcase/[scenario]/page.tsx` -- add OG image + twitter card
- `src/app/layout.tsx` -- add og:site_name, default og:image
- `src/app/upload/page.tsx` -- replace shareable link with ShareButtons
- Supabase migration -- add short_code column to briefs table
