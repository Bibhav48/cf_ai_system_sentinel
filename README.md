# ⚡ System Sentinel: AI-Powered Log Analysis & Incident Tracking

A real-time log analysis and incident tracking system that uses AI to perform root-cause analysis on distributed system logs. Built on Cloudflare's serverless platform for instant global deployment and zero infrastructure management.

## Project Overview

**System Sentinel** is an SRE-focused tool that transforms raw system logs into actionable intelligence through AI-powered analysis. Instead of wading through thousands of log lines, paste your logs and receive:

- **Root-cause analysis** of failures
- **Contributing factors** identification
- **Immediate mitigation steps**
- **Long-term prevention recommendations**
- **Persistent incident history** with severity tracking

### Key Features

✅ **AI-Powered Analysis** – Llama 3.3 on Workers AI for technical root-cause analysis  
✅ **Stateful Incident Tracking** – Durable Objects for persistent, globally-consistent history  
✅ **Real-time Dashboard** – Terminal-style UI for log ingestion and incident review  
✅ **Serverless & Global** – Deploy once, run everywhere on Cloudflare's edge network  
✅ **Zero Infrastructure** – No VMs, no databases to manage, no infrastructure costs  

---

## Architecture

### The Three Pillars of Cloudflare Platform

#### 1. **Compute: Cloudflare Workers**
Acts as the traffic coordinator and HTTP handler. Receives log submissions from users, orchestrates AI analysis, and serves the dashboard.

- **Endpoints:**
  - `POST /analyze` – Submit logs for AI analysis
  - `GET /incidents` – Retrieve incident history
  - `GET /summary` – Get statistics (total incidents, severity breakdown)
  - `GET /` – Serve dashboard UI

#### 2. **State: Durable Objects**
Maintains a **SentinelState** Durable Object that stores incident history with strong consistency guarantees.

- **Guarantees:** Exactly-once execution, ACID transactions, persistent storage
- **Storage:** SQLite-backed Durable Object storage (no external database needed)
- **Data Model:**
  ```typescript
  interface Incident {
    id: string;
    timestamp: number;
    rawLogs: string;
    analysis: string;
    severity: "critical" | "high" | "medium" | "low";
  }
  ```
- **RPC Methods:**
  - `storeIncident(incident)` – Persist incident with analysis
  - `getIncidents(limit)` – Retrieve recent incidents
  - `getSummary()` – Get statistics

#### 3. **Intelligence: Workers AI + Llama 3.3**
Serverless GPU inference for log analysis without maintaining ML infrastructure.

- **Model:** `@cf/meta/llama-3.3-70b-instruct-fp8`
- **System Prompt:** Tuned for SRE-specific root-cause analysis
- **Processing:** Rapid inference with streaming support

### Data Flow

```
┌─────────────────────┐
│   User Dashboard    │
│  (public/index.html)│
└──────────┬──────────┘
           │ (POST /analyze)
           ↓
┌─────────────────────────────────┐
│   Cloudflare Worker             │
│   (src/index.ts - fetch handler)│
└──────────┬──────────────────────┘
           │
      ┌────┴────┐
      ↓         ↓
   ┌──────┐ ┌──────────────┐
   │  AI  │ │   Durable    │
   │Llama │ │   Objects    │
   │ 3.3  │ │ (Stateful)   │
   └──────┘ └──────────────┘
      │         │
      └────┬────┘
           ↓
    ┌────────────────┐
    │  Analysis +    │
    │  Incident Data │
    └────────────────┘
           │
           ↓
    ┌────────────────┐
    │  Dashboard UI  │
    │ (Real-time)    │
    └────────────────┘
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account (free tier supported)

### Local Development

```bash
# Install dependencies
npm install

# Generate TypeScript types for bindings
npm run cf-typegen

# Start local development server
npm run dev
```

The worker will start on `http://localhost:8787`

- Dashboard: `http://localhost:8787/`
- API: `http://localhost:8787/analyze`, `/incidents`, `/summary`

### Testing Locally

**Step 1:** Open the dashboard at `http://localhost:8787/`

**Step 2:** Paste sample logs in the input area:

```
[ERROR] 2026-04-02T10:23:45Z Connection timeout to db-primary-east
[WARN] 2026-04-02T10:23:46Z Retrying connection with exponential backoff
[ERROR] 2026-04-02T10:23:48Z Max retries exceeded for db-primary-east
[PANIC] 2026-04-02T10:23:50Z Database layer unavailable - switching to cache-fallback
[ERROR] 2026-04-02T10:23:51Z Cache layer also degraded (95% full)
[CRITICAL] 2026-04-02T10:23:52Z Request queue building up, 5000+ pending requests
[ERROR] 2026-04-02T10:23:53Z Service degradation detected - activating circuit breaker
```

**Step 3:** Click "Analyze Logs" (or press Ctrl+Enter)

**Step 4:** View AI-generated analysis and incident tracking

### Deploy to Cloudflare

```bash
# Publish to Cloudflare
npm run deploy
```

Your application will be deployed to a `.workers.dev` domain and receive a unique URL.

---

## API Reference

### POST /analyze
Analyze logs with Llama 3.3 and persist incident.

**Request:**
```json
{
  "logs": "string containing raw system logs"
}
```

**Response:**
```json
{
  "id": "incident-1743667425000-abc123xyz",
  "timestamp": 1743667425000,
  "rawLogs": "...",
  "analysis": "Root-cause analysis from Llama 3.3...",
  "severity": "high"
}
```

### GET /incidents
Retrieve incident history.

**Query Parameters:**
- `limit` (optional): Maximum incidents to return (default: 50, max: 100)

**Response:**
```json
{
  "incidents": [
    {
      "id": "incident-1743667425000-abc123xyz",
      "timestamp": 1743667425000,
      "rawLogs": "...",
      "analysis": "...",
      "severity": "high"
    }
  ],
  "count": 5
}
```

### GET /summary
Get incident statistics.

**Response:**
```json
{
  "total": 42,
  "critical": 2,
  "high": 8,
  "medium": 15,
  "low": 17,
  "lastIncident": { /* incident object */ }
}
```

---

## Configuration

### wrangler.jsonc

The configuration file defines all Cloudflare resources:

```jsonc
{
  "name": "cf-ai-system-sentinel",
  "main": "src/index.ts",
  "compatibility_date": "2026-03-29",
  
  // Durable Object binding for stateful incident storage
  "durable_objects": {
    "bindings": [
      {
        "name": "SENTINEL_STATE",
        "class_name": "SentinelState"
      }
    ]
  },
  
  // Workers AI binding for Llama 3.3
  "ai": {
    "binding": "AI"
  },
  
  // Static assets (dashboard UI)
  "assets": {
    "directory": "./public"
  },
  
  // Enable observability for monitoring
  "observability": {
    "enabled": true
  }
}
```

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Compute** | Cloudflare Workers | Serverless request handler |
| **State** | Durable Objects (SQLite) | Persistent incident storage |
| **AI/ML** | Workers AI (Llama 3.3) | Root-cause analysis inference |
| **Frontend** | Vanilla JS + CSS | Terminal-style dashboard |
| **Infrastructure** | Cloudflare Global Network | Edge deployment, zero latency |

---

## Use Cases

### 1. **Post-Incident Analysis**
Quickly triage incidents by pasting raw logs. Get immediate root-cause hypothesis instead of manual log parsing.

### 2. **On-Call Support**
Reduce Mean Time To Resolution (MTTR) by automating initial incident assessment.

### 3. **Compliance & Auditing**
Maintain persistent incident history with AI-generated analysis for regulatory and post-mortems.

### 4. **Training & Knowledge Transfer**
Archive past incidents to build institutional knowledge about system failure modes.

---

## How AI Analysis Works

### System Prompt Tuning

The system prompt is carefully crafted for SRE-specific analysis:

```
You are a Senior Site Reliability Engineer (SRE) analyzing distributed system logs.
Your task is to perform rapid root-cause analysis:

1. Identify the PRIMARY FAILURE MODE (what failed first)
2. List CONTRIBUTING FACTORS (what made it worse)
3. Suggest IMMEDIATE MITIGATIONS (what to do NOW)
4. Recommend LONG-TERM FIXES (what to prevent recurrence)

Be concise and technical. Ignore benign logs. Focus on errors, timeouts, and cascading failures.
Output only actionable insights—no fluff.
```

### Severity Classification

Incidents are automatically classified by examining log patterns:

| Severity | Triggers |
|----------|----------|
| **critical** | panic, fatal, critical, outage |
| **high** | error, failure, crashed, timeout |
| **medium** | warn, degradation, slow |
| **low** | informational logs, no errors |

---

## Development

### Project Structure

```
.
├── src/
│   └── index.ts              # Worker handler + Durable Object
├── public/
│   └── index.html            # Dashboard UI
├── wrangler.jsonc            # Cloudflare resource configuration
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies
├── README.md                 # This file
└── PROMPTS.md               # AI prompts used in development
```

### Key Files Explained

#### `src/index.ts`
- **SentinelState class**: Durable Object implementation for persistent storage
- **Worker handler**: HTTP endpoint handler with routing logic
- **AI integration**: Llama 3.3 inference with custom system prompt
- **Severity detection**: Pattern-based incident classification

#### `public/index.html`
- Terminal-style dashboard with dark theme
- Real-time incident feed
- Log input area with syntax highlighting
- Statistics dashboard (total incidents, severity breakdown)

### TypeScript Types

After modifying `wrangler.jsonc` bindings, regenerate types:

```bash
npm run cf-typegen
```

This ensures full type safety for:
- Durable Object bindings
- Workers AI bindings
- Environment variables

---

## Limits & Quotas

### Free Tier (Cloudflare)

- **Workers requests**: 100,000/day
- **Durable Object requests**: 1,000,000/month
- **Workers AI inference**: Limited free credits
- **Storage**: Up to 1 GB per Durable Object namespace

### Performance

- **AI inference latency**: ~500ms–2s (first request may be slower)
- **Dashboard load time**: <100ms (edge-cached)
- **Incident storage**: SQLite-backed, microsecond-scale lookups

### Customization

To use a different AI model, update `src/index.ts`:

```typescript
await ai.run("@cf/meta/llama-2-7b-chat-int8", { /* ... */ })
```

See [Cloudflare Workers AI models](https://developers.cloudflare.com/workers-ai/models/) for full catalog.

---

## Troubleshooting

### Issue: "AI inference failed"

**Solution**: Ensure Workers AI is enabled in your Cloudflare dashboard. Free tier may have quota limits.

### Issue: Durable Object state not persisting

**Solution**: Ensure migrations are configured in `wrangler.jsonc`:

```jsonc
"migrations": [
  {
    "tag": "v1",
    "new_classes": ["SentinelState"]
  }
]
```

### Issue: Dashboard shows 404

**Solution**: Verify assets are configured:

```jsonc
"assets": {
  "directory": "./public"
}
```

### Issue: CORS errors from dashboard

**Solution**: The Worker already includes CORS headers. If issues persist, check browser console for specific errors.

---

## Production Deployment Checklist

- [ ] Deploy with `npm run deploy`
- [ ] Test all endpoints with real logs
- [ ] Monitor error rates in Cloudflare dashboard
- [ ] Set up alerts for critical incidents
- [ ] Archive incidents periodically (export from `/incidents`)
- [ ] Review AI analysis accuracy monthly

---

## Future Enhancements

- [ ] Support for structured log formats (JSON, protobuf)
- [ ] Custom alerting webhooks (Slack, PagerDuty, OpsGenie)
- [ ] Metrics export (APM integration)
- [ ] Multi-tenant support with namespace isolation
- [ ] Advanced filtering & search across incident history
- [ ] Predictive anomaly detection (threshold-based)

---

## Support

For questions or issues:
- **Cloudflare Docs**: https://developers.cloudflare.com/
- **Workers Discord**: https://discord.cloudflare.com/
- **Report bugs**: GitHub Issues (if applicable)

---

## License

This project is provided as-is for the Cloudflare Fast-Track Candidate Review.

---

**Built with Cloudflare Workers, Durable Objects, and Workers AI** 🚀
