# AI Prompts Used in Development

This document records the AI-assisted coding process for **System Sentinel**. Per requirements, AI coding is encouraged—here are the prompts used during development.

---

## Architecture & System Design Prompts

### Prompt 1: Data Model Design

**Used for:** Incident storage schema

```
Design a TypeScript interface for storing incident data in Durable Objects.
Include: unique ID, timestamp, raw logs, AI analysis, and severity classification.
This will be stored in SQLite and needs to be queryable by severity.
```

**Outcome:** Defined `Incident` interface with all fields for efficient storage

### Prompt 2: Durable Object RPC Methods

**Used for:** Coordination between Worker and Durable Object

```
What RPC methods should a Durable Object expose for:
1. Storing a new incident with AI analysis
2. Retrieving incidents with optional limit parameter
3. Getting summary statistics (total, by severity)
```

**Outcome:** Designed `storeIncident()`, `getIncidents()`, `getSummary()` methods

### Prompt 3: REST API Endpoints

**Used for:** Worker HTTP handler routing

```
Design REST endpoints for a log analysis service:
- Accept logs and return AI analysis
- Retrieve incident history
- Get statistics dashboard
- Serve static assets
```

**Outcome:** Structured `/analyze`, `/incidents`, `/summary`, `/` routes

---

## LLM Integration Prompts

### Prompt 4: System Prompt for Llama 3.3

**Used for:** Root-cause analysis output format

```
Write a system prompt for Llama 3.3 to analyze distributed system logs.
Should identify: primary failure mode, contributing factors, immediate mitigations, long-term fixes.
Be concise and technical. Ignore benign logs.
```

**Outcome:** SRE-focused system prompt in `src/index.ts`

### Prompt 5: Workers AI Integration

**Used for:** Calling Llama 3.3 from Worker

```
How to call Llama 3.3 from Cloudflare Workers?
Parameters needed: system prompt, user message, max_tokens.
Which model variant (FP8 vs FP16) balances latency and accuracy?
```

**Outcome:** Implemented `ai.run()` with messages API, FP8 quantization

---

## Frontend Prompts

### Prompt 6: Terminal-Style Dashboard

**Used for:** HTML/CSS/JS dashboard UI

```
Create an HTML dashboard for log analysis:
- Dark theme (terminal aesthetic)
- Split layout: log input (left), analysis output (right)
- Severity indicators with color coding
- Real-time incident feed
- Statistics display
```

**Outcome:** `public/index.html` with terminal design (#0a0e27, #00ff88)

### Prompt 7: Frontend API Integration

**Used for:** Dashboard JavaScript logic

```
Write JavaScript functions to:
1. POST logs to /analyze and display results
2. GET /incidents and show incident history
3. GET /summary and update statistics
4. Handle errors gracefully
```

**Outcome:** Dashboard API integration in `public/index.html`

---

## Implementation & Configuration Prompts

### Prompt 8: Severity Classification

**Used for:** Auto-detecting incident severity

```
How to classify incident severity from logs?
Patterns: critical (panic, fatal), high (error, timeout), medium (warn), low (info).
Should check both raw logs and AI analysis?
```

**Outcome:** `determineSeverity()` method checking both sources

### Prompt 9: Error Handling

**Used for:** Worker error handling

```
Best practices for error handling in Cloudflare Workers:
- AI inference failures
- Invalid input (missing logs)
- Durable Object failures
Return appropriate HTTP status codes.
```

**Outcome:** Try/catch with HTTP 500, 400, 404 responses

### Prompt 10: Durable Object Configuration

**Used for:** wrangler.jsonc setup

```
Configure Durable Objects in wrangler.jsonc:
- Binding name: SENTINEL_STATE
- Class name: SentinelState
- Include schema migrations for versioning
```

**Outcome:** Configured migrations and bindings in `wrangler.jsonc`

### Prompt 11: TypeScript Bindings

**Used for:** Type safety

```
Generate TypeScript types for Cloudflare bindings.
Need to access: Durable Object namespace, Workers AI binding.
```

**Outcome:** Defined `Env` interface, added `npm run cf-typegen`

---

## Summary: AI's Role

Each prompt above corresponds to specific code in the project:

| Prompt | File                | Result                                  |
| ------ | ------------------- | --------------------------------------- |
| 1-2    | `src/index.ts`      | SentinelState class, Incident interface |
| 3      | `src/index.ts`      | HTTP routes and handler                 |
| 4      | `src/index.ts`      | System prompt for Llama 3.3             |
| 5      | `src/index.ts`      | `analyzeLogsWithAI()` method            |
| 6-7    | `public/index.html` | Dashboard UI and JavaScript             |
| 8-11   | Multiple            | Supporting functions and configuration  |

**Process:** Each prompt guided code generation, which was then reviewed and refined for correctness and performance.

---

**All implementations verified and tested locally before deployment.**
