# Agentic AI Strategy

Where and how autonomous AI agents fit into Civic Brief's architecture.

---

## Guiding Principle

**Agentic for ingestion and classification. Human-in-the-loop for verification and distribution.**

Research context: OpenClaw demonstrated that agentic AI (autonomous task execution via LLMs) is powerful but carries significant security risks. Cisco found prompt injection and data exfiltration in third-party skills. For a civic trust tool, we need bounded autonomy with human oversight at every decision that reaches citizens.

---

## Agent Use Cases by Scenario

| Scenario | Agent | What It Does | Autonomy Level | Phase |
|----------|-------|-------------|----------------|-------|
| All | Feed monitor | Watches government RSS/API feeds, detects new documents, downloads PDFs, triggers pipeline | Fully autonomous (bounded: reads public URLs only, triggers existing pipeline only) | 2 |
| All | Jurisdiction classifier | Reads document, determines which jurisdiction(s) it applies to, tags via PostGIS | Autonomous with human review for low-confidence classifications | 2 |
| Budget | Budget parser | Extracts structured financial data (line items, amounts, YoY changes) from budget PDFs | Autonomous with verification step | 2 |
| Legislation | Bill tracker | Monitors state legislature APIs, detects status changes (introduced, committee, voted, signed), triggers re-briefing | Fully autonomous (reads public APIs only) | 2 |
| Multilingual | Distribution agent | Formats briefs for WhatsApp/SMS, posts to configured channels | Human-approved (user configures channels, agent executes) | 3 |
| Zoning | Geographic tagger | Extracts addresses/locations from zoning docs, geocodes, creates PostGIS geometries | Autonomous with human review | 3 |

---

## What We Will NOT Do

- No agents with write access to production databases without human approval
- No agents that send messages to external services without user configuration
- No broad-autonomy "run your computer" agents
- No agents that modify their own prompts or self-improve without review
- No agents that access private or authenticated resources on behalf of users

---

## Implementation Approach

### Tool-bounded agents
Each agent has an explicit list of tools it can call. No open-ended access. Claude's native tool use (structured tool calling) enforces this boundary.

### Audit trail
All agent actions are logged with: timestamp, agent name, action taken, input, output, confidence score. This is both a debugging tool and a trust mechanism.

### Confidence routing
Low-confidence results (below threshold per agent type) are queued for human review instead of being published automatically.

---

## Framework Evaluation

All options below are open source and free:

| Framework | Strengths | Best For | Consideration |
|-----------|----------|----------|---------------|
| **Claude tool use (native)** | No framework needed, already using Claude API, simple bounded agents | Phase 2 agents (feed monitor, jurisdiction classifier) | Start here |
| **LangGraph** (LangChain) | Graph-based orchestration, good for multi-step pipelines | Complex document processing chains | Evaluate if multi-step orchestration gets complex in Phase 3 |
| **CrewAI** | Multi-agent collaboration, role-based agents | Feed monitoring + classification + briefing as separate cooperating agents | Consider for Phase 3 if agent count grows |

### Recommendation

Start with Claude's native tool use for Phase 2. It is already integrated, requires no new dependencies, and handles the bounded agent pattern well. Evaluate LangGraph or CrewAI only if multi-step orchestration or multi-agent coordination becomes a bottleneck.

---

## Security Considerations for Agents

1. **Input sanitization**: All URLs fetched by agents go through `src/lib/security.ts` validation
2. **Rate limiting**: Agents are subject to the same rate limits as user requests
3. **Sandboxing**: Agents cannot access the filesystem, only the APIs they are explicitly given
4. **No prompt chaining**: Agent outputs are never used as prompts for other agents without sanitization (prevents prompt injection propagation)
5. **Monitoring**: Agent error rates and confidence distributions are tracked for anomaly detection
