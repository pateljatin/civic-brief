# Civic Data Tools and Operationalization: Research Report

**Date:** 2026-04-16
**Status:** Research complete, ready for spec writing

---

## Context

Civic Brief already has C7 (feed ingestion) shipped with three fetchers: RSS/Atom, Legistar REST API, and OpenStates JSON API. The question here is: what else is out there? What tools can help discover more government feeds, ingest more document types, and make the jurisdiction data model richer? This research covers OpenClaw, the OCD ecosystem, government APIs, and boundary data pipelines.

---

## OpenClaw: What It Actually Is

OpenClaw is an open-source autonomous AI agent framework, not a civic data tool. This is important to understand clearly before building anything around it.

**Origin:** Published in November 2025 by Austrian developer Peter Steinberger under the name Clawdbot. Renamed to Moltbot on January 27, 2026, following trademark complaints by Anthropic (the name clashed with Claude branding). Renamed again to OpenClaw three days later. As of early 2026 it had surpassed 350,000 GitHub stars, making it one of the fastest-growing open-source projects in history.

**What it does:** OpenClaw is a general-purpose agent that runs locally on your machine and connects through messaging apps you already use (WhatsApp, Telegram, Slack, Signal). It can execute shell commands, browser automation, email, calendar, and file operations on your behalf, driven by LLMs (Claude, GPT, DeepSeek).

**Is it a civic data tool?** No. There is no built-in government data integration. The civic data connection would be emergent: you could instruct an OpenClaw agent to periodically check a government website and alert you when new PDFs appear. But that's just browser automation with an LLM wrapper. It's not more capable than what we already built in C7 with targeted fetchers.

**Security note:** In March 2026, Chinese authorities restricted state-run enterprises and government agencies from running OpenClaw apps on office computers due to security concerns. This is worth noting because Civic Brief's threat model includes institutional trust; deploying OpenClaw as a component in a civic transparency tool could create perception problems.

**Bottom line for Civic Brief:** OpenClaw is not a fit. It's a general agent framework, not a structured data ingestion tool. Our existing C7 feed worker architecture (cron -> HMAC dispatch -> per-feed workers -> pipeline) is a better pattern for predictable, auditable, cost-controlled ingestion. OpenClaw's value would only appear if we needed an ad-hoc agent to browse arbitrary government portals without structured APIs, and even then, Playwright-based crawlers are more predictable.

---

## Open Civic Data (OCD) Ecosystem

This is directly relevant. Civic Brief already uses OCD division IDs in the jurisdictions table. Here's the full picture.

### What OCD Is

Open Civic Data is a collaborative effort (originally spun out of the Sunlight Foundation) to define common schemas and provide tools for collecting information on government organizations, officials, legislation, and events. It standardizes the messy reality of 90,000+ US government entities into a consistent format.

The hierarchy: **Divisions** (geographic units, identified by OCD-IDs) -> **Jurisdictions** (a government body operating within a Division) -> **Organizations** (the council, the committee) -> **People** (the officials).

An OCD-ID looks like: `ocd-jurisdiction/country:us/state:wa/place:seattle/council`

### OCD Tools in the Ecosystem

**python-opencivicdata** ([github.com/opencivicdata/python-opencivicdata](https://github.com/opencivicdata/python-opencivicdata)): Django models and utilities for working with OCD data. Useful if running a Python backend or migration scripts, not directly applicable to a Next.js app.

**python-opencivicdata-api** ([github.com/opencivicdata/python-opencivicdata-api](https://github.com/opencivicdata/python-opencivicdata-api)): Python client for the OCD API. Has three built-in client configurations: OCDAPI (generic), VagrantOCDAPI (local dev), and a Sunlight-hosted client.

**ocd-division-ids** ([github.com/opencivicdata/ocd-division-ids](https://github.com/opencivicdata/ocd-division-ids)): The canonical repository of OCD division ID definitions for every US jurisdiction. This is the source of truth for what `ocd_id` should contain in the Civic Brief jurisdictions table. The repo is structured as CSVs; we can use it to populate missing OCD IDs for our seed jurisdictions.

**Key gap in Civic Brief today:** The `jurisdictions` table has the `ocd_id` column, but our seed data (7 jurisdictions) may not have all OCD IDs populated correctly. Cross-referencing with `ocd-division-ids` would let us validate and complete these IDs without writing a custom scraper.

### OpenStates (Already Integrated, But More to Know)

OpenStates aggregates legislative data for all 50 US states, DC, and Puerto Rico. C7 already has an OpenStates fetcher. Additional capabilities worth using:

- **Bulk data downloads**: CSV and JSON files for all bills and votes, per session. Available at `data.openstates.org/postgres/monthly/YYYY-MM-public.pgdump`. This is useful for backfilling historical data, not just live polling.
- **API v3** (active as of January 2026): `v3.openstates.org`. Our C7 fetcher likely targets this.
- **People data**: Legislators with contact details, committee memberships. Could populate a future "contact your representative" feature.

---

## Government Data APIs: Comprehensive Map

Here is every relevant API for Civic Brief's ingestion layer, organized by scope.

### Federal Level

**Federal Register API** ([federalregister.gov/developers/documentation/api/v1](https://www.federalregister.gov/developers/documentation/api/v1))
- No API key required. Returns JSON or CSV.
- Endpoints: search documents, fetch by FR document number, fetch multiple documents.
- Coverage: all Federal Register content since 1994, including Executive Orders and pre-publication "Public Inspection" documents.
- Relevance: High. Federal rulemaking, executive orders, and agency notices directly affect local communities (housing, environmental standards, etc.).
- Integration fit: REST, returns document metadata + PDF links. Could feed into our Legistar-style fetcher with minor adaptation.

**GovInfo API** ([govinfo.gov/developers](https://www.govinfo.gov/developers))
- Rate limit: 5,000 requests/hour. Returns up to 250 results per request.
- Coverage: Congressional bills (113th Congress to present), Code of Federal Regulations, Congressional Record.
- Notable: GPO recently released a **GovInfo MCP server** as a public preview, allowing direct LLM integration. This is worth watching; it could simplify our federal document ingestion significantly.
- Bulk data: XML bulk downloads available for congressional bills, bill status, summaries, CFR.

**Congress.gov API** ([loc.gov/apis/additional-apis/congress-dot-gov-api](https://www.loc.gov/apis/additional-apis/congress-dot-gov-api/))
- Machine-readable access to Library of Congress legislative collections.
- Covers bills, amendments, votes, member information.
- Separate from GovInfo but complementary.

**ProPublica Congress API**
- Status: **No longer available** as of 2025. Do not build against this.
- Historical reference use only.

**Regulations.gov API** ([open.gsa.gov/api/regulationsgov](https://open.gsa.gov/api/regulationsgov/))
- Requires API key registration. Has a commenting API for public comment periods.
- Endpoints: `/v4/documents`, `/v4/dockets`, `/v4/comments`.
- Relevance: Medium-high. Public comment periods are one of our key civic action items ("what can you do?"). Knowing when a comment period opens is high-value content.

### State Level

**OpenStates API v3** (already integrated in C7)
- Covers all 50 states + DC + Puerto Rico.
- Also covers local ballot measures in some states.
- Bulk data: `data.openstates.org`

**Legistar Web API** (already integrated in C7)
- `webapi.legistar.com/v1/{Client}/matters`
- Granicus hosts Legistar for hundreds of US city and county councils.
- To discover new clients (cities): The Legistar network doesn't have a central directory API. Known clients must be manually identified. Community-maintained lists exist on GitHub.

### Local Level

**Google Civic Information API** ([developers.google.com/civic-information](https://developers.google.com/civic-information))
- Location-based lookup for elected officials, polling places, election information.
- Not a document source, but useful for our "contact your representative" and jurisdiction detection features.
- API key required, free tier available.

**US Vote Foundation Civic Data API** ([civicdata.usvotefoundation.org](https://civicdata.usvotefoundation.org/))
- Comprehensive US civic data: voter registration deadlines, election dates, polling locations.
- Licensed data; not fully open.

**GovTrack Bulk Data**
- Status: GovTrack has ended its bulk data and API services. Do not build against this.

### Legal Data (Adjacent)

**worldwidelaw/legal-sources** ([github.com/worldwidelaw/legal-sources](https://github.com/worldwidelaw/legal-sources))
- Open-source collection scripts for legal data from 110+ countries.
- Maintained by an autonomous Legal Data Hunter agent.
- Mostly useful for international expansion (v2.0 roadmap).

---

## Jurisdiction Boundary Data Pipelines

### Census TIGER/Line

The US Census Bureau's TIGER/Line Shapefiles are the authoritative source for jurisdiction boundaries. The 2025 TIGER/Line Shapefiles were released September 23, 2025. The 2026 BAS (Boundary and Annexation Survey) partnership shapefiles are available for review.

**Data formats:** Shapefile (.shp), Geodatabase (.gdb). Both work with PostGIS via `shp2pgsql` or GDAL.

**Available geometry layers relevant to Civic Brief:**
- State boundaries
- County and county-equivalent boundaries
- Places (incorporated cities, census-designated places)
- Congressional districts
- State legislative districts

**The loading pipeline:**

Step 1: Download from `census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html`

Step 2: Load into PostGIS using GDAL/ogr2ogr:
```bash
ogr2ogr -f "PostgreSQL" PG:"host=... dbname=..." \
  tl_2025_us_county.shp \
  -nln tiger_counties \
  -t_srs EPSG:4326
```

Step 3: Join to `jurisdictions` table by FIPS code or OCD-ID.

Step 4: Update `jurisdictions.boundary` (MultiPolygon) and `jurisdictions.centroid` (Point).

**This is C14's core work** (PostGIS brief tagging). The gap analysis in the C14 research doc confirms all 14 seeded jurisdictions have NULL centroid and boundary. TIGER/Line is the source to fix this.

**Automation tool to know: `pyogrio`** (Python) and `gdal` (CLI) are the standard tools for TIGER loading pipelines. No specialized "civic data" tool needed; this is standard GIS data engineering.

**Census API for boundaries** ([api.census.gov/data/...CARTOGRAPHIC_BOUNDARY](https://www.census.gov/data/developers/data-sets/Cartographic-Boundary-files.html))
- Returns simplified (less detailed) boundary geometries via REST API.
- Useful for quick lookups; not suitable for high-precision PostGIS operations.
- No download required; pull on demand.

---

## Priority Matrix for Civic Brief Operationalization

| Data Source | Already Integrated | Priority | Effort | Value |
|---|---|---|---|---|
| OpenStates API v3 | Yes (C7) | -- | -- | -- |
| Legistar REST | Yes (C7) | -- | -- | -- |
| RSS/Atom feeds | Yes (C7) | -- | -- | -- |
| Federal Register API | No | High | Low | High |
| GovInfo API | No | Medium | Low | Medium |
| ocd-division-ids (OCD IDs for seed data) | No | High | Low | High |
| TIGER/Line -> PostGIS boundary load | No | High (C14) | Medium | High |
| Regulations.gov (comment periods) | No | Medium | Low | Medium |
| Google Civic Information API | No | Medium | Low | Medium |
| GovInfo MCP server | No | Low (watch) | Low | Unknown |
| Congress.gov API | No | Low | Low | Low |
| OpenClaw | No | Not recommended | -- | -- |
| ProPublica Congress API | Deprecated | Not applicable | -- | -- |
| GovTrack bulk data | Deprecated | Not applicable | -- | -- |

---

## Recommended Next Actions

### Immediate (v1.1 scope)

1. **Federal Register API feed**: Add a new fetcher to C7's feed worker for `federalregister.gov`. Start with a search query scoped to the jurisdictions we have seeded (Seattle, King County, WA state). The API requires no key and returns PDF links directly. This adds federal-level civic content to the platform with roughly one day of work.

2. **OCD division IDs for seed jurisdictions**: Cross-reference `github.com/opencivicdata/ocd-division-ids` to validate and complete `ocd_id` values in `supabase/seed/demo-jurisdictions.sql`. This is a data quality fix, not a code change.

3. **Regulations.gov comment periods**: Integrate the Regulations.gov `/v4/documents` endpoint to surface active public comment periods. Map the `docketId` to relevant jurisdictions. The civic brief "what can you do" section becomes much richer when we can link to actual comment submission pages.

### C14 Scope

4. **TIGER/Line boundary load script**: Write a one-time migration script using `ogr2ogr` or `shp2pgsql` to load 2025 TIGER/Line county and place boundaries into the jurisdictions table. This unblocks `jurisdictions_at_point()` and the full PostGIS location-based discovery feature.

### Future (v1.2+)

5. **GovInfo MCP server**: Monitor the GPO's MCP server for federal document discovery. If it stabilizes, it could replace our custom Federal Register fetcher with a standardized interface.

6. **OpenStates bulk data backfill**: Use the monthly Postgres dumps from `data.openstates.org` to backfill historical brief generation for high-priority states (WA, CA, TX, NY as a starting set).

---

## Tooling Reference

- Open Civic Data GitHub: [github.com/opencivicdata](https://github.com/opencivicdata)
- OCD Division IDs canonical repo: [github.com/opencivicdata/ocd-division-ids](https://github.com/opencivicdata/ocd-division-ids)
- OpenStates docs: [docs.openstates.org](https://docs.openstates.org/)
- OpenStates API v3: [docs.openstates.org/api-v3/](https://docs.openstates.org/api-v3/)
- OpenStates bulk data: [openstates.org/downloads/](https://openstates.org/downloads/)
- Federal Register API: [federalregister.gov/developers/documentation/api/v1](https://www.federalregister.gov/developers/documentation/api/v1)
- GovInfo API: [govinfo.gov/developers](https://www.govinfo.gov/developers)
- Congress.gov API: [loc.gov/apis/additional-apis/congress-dot-gov-api](https://www.loc.gov/apis/additional-apis/congress-dot-gov-api/)
- Regulations.gov API: [open.gsa.gov/api/regulationsgov](https://open.gsa.gov/api/regulationsgov/)
- Legistar Web API: [webapi.legistar.com](https://webapi.legistar.com/)
- TIGER/Line Shapefiles: [census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html)
- OpenClaw Wikipedia: [en.wikipedia.org/wiki/OpenClaw](https://en.wikipedia.org/wiki/OpenClaw)
- worldwidelaw legal-sources: [github.com/worldwidelaw/legal-sources](https://github.com/worldwidelaw/legal-sources)
