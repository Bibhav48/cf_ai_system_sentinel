# System Sentinel

AI-powered log analysis and incident tracking on Cloudflare.

## Live Deployment
- URL: https://cf-ai-system-sentinel.adhikaribibhav.workers.dev
- Version ID: eb3a29a5-ab9f-4bcd-b526-6378fa9a7c07

## What This Project Includes
- LLM: Workers AI using `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- Workflow/coordination: Cloudflare Worker + Durable Object RPC
- User input: Web dashboard at `/` for log paste + analysis
- Memory/state: SQLite-backed Durable Object storage

## API
- `POST /analyze`
- `GET /incidents?limit=20`
- `GET /summary`

### `POST /analyze`
Request:
```json
{
  "logs": "2026-04-02T10:15:27Z ERROR [db] Connection timeout"
}
```

Response shape:
```json
{
  "id": "incident-...",
  "timestamp": 1775120488239,
  "rawLogs": "...",
  "analysis": "...",
  "severity": "high"
}
```

## Local Run
```bash
npm install
npm run cf-typegen
npm run dev
```

Open:
- Dashboard: `http://localhost:8787/`
- API: `http://localhost:8787/analyze`

## Deploy
```bash
npm run deploy
```

## Quick Test
```bash
curl -X POST http://localhost:8787/analyze \
  -H "Content-Type: application/json" \
  -d '{"logs":"2026-04-02T10:15:29Z FATAL [payment-service] Panic: nil pointer dereference"}'
```

## Project Files
- `src/index.ts`: Worker routes, Durable Object class, AI integration
- `public/index.html`: Dashboard UI + markdown-to-HTML rendering for analysis output
- `wrangler.jsonc`: Bindings, migrations, assets config
- `PROMPTS.md`: AI prompts used during development

## Notes
- Durable Object migration uses `new_sqlite_classes` (required on Free plan).
- Dashboard converts markdown-like AI output into safe HTML for readable rendering.
- If the AI upstream is unavailable, the app falls back to a heuristic analysis response.
