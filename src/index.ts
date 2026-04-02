import { DurableObject } from 'cloudflare:workers';

/** Type-safe environment object with bindings */
interface Env {
	SENTINEL_STATE: DurableObjectNamespace;
	AI: Ai;
}

/** Incident analysis result */
interface Incident {
	id: string;
	timestamp: number;
	rawLogs: string;
	analysis: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * SentinelState - A stateful Durable Object that maintains system incident history
 * and provides persistent memory for root-cause analysis results.
 */
export class SentinelState extends DurableObject {
	private state: DurableObjectState;
	private env: Env;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.state = state;
		this.env = env;
	}

	/**
	 * Store an incident with AI-generated analysis
	 */
	async storeIncident(incident: Omit<Incident, 'id'>): Promise<Incident> {
		const id = `incident-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const fullIncident: Incident = { id, ...incident };

		await this.state.storage.put(`incident:${id}`, JSON.stringify(fullIncident));

		// Keep a list of all incident IDs for efficient retrieval
		const incidents = (await this.state.storage.get('incident:list')) as string[] | undefined;
		const updatedList = incidents ? [...incidents, id] : [id];
		await this.state.storage.put('incident:list', updatedList);

		return fullIncident;
	}

	/**
	 * Retrieve all incidents or incidents within a time range
	 */
	async getIncidents(limit: number = 50): Promise<Incident[]> {
		const incidentIds = (await this.state.storage.get('incident:list')) as string[] | undefined;

		if (!incidentIds || incidentIds.length === 0) {
			return [];
		}

		const recentIds = incidentIds.slice(-limit);
		const incidents: Incident[] = [];

		for (const id of recentIds) {
			const incident = await this.state.storage.get(`incident:${id}`);
			if (incident) {
				incidents.push(JSON.parse(incident as string));
			}
		}

		return incidents.reverse(); // Most recent first
	}

	/**
	 * Get incident summary statistics
	 */
	async getSummary(): Promise<{
		total: number;
		critical: number;
		high: number;
		medium: number;
		low: number;
		lastIncident?: Incident;
	}> {
		const incidents = await this.getIncidents(1000);
		const summary = {
			total: incidents.length,
			critical: 0,
			high: 0,
			medium: 0,
			low: 0,
		};

		for (const incident of incidents) {
			summary[incident.severity]++;
		}

		return {
			...summary,
			lastIncident: incidents[0],
		};
	}
}

/**
 * Main Worker handler - coordinates log ingestion and AI analysis
 */
export default {
	/**
	 * HTTP request handler for the Worker
	 */
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;

		// CORS headers
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		// Handle preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: corsHeaders,
			});
		}

		try {
			// Route: POST /analyze - analyze logs with AI
			if (pathname === '/analyze' && request.method === 'POST') {
				const body = (await request.json()) as { logs: string };

				if (!body.logs || typeof body.logs !== 'string') {
					return new Response(JSON.stringify({ error: "Missing or invalid 'logs' field" }), {
						status: 400,
						headers: { 'Content-Type': 'application/json', ...corsHeaders },
					});
				}

				// Call Llama 3.3 for root-cause analysis, but keep endpoint available on upstream AI failures.
				const analysis = await this.analyzeLogsWithAI(body.logs, env.AI).catch((error) => {
					console.error('Falling back to heuristic analysis:', error);
					return this.generateFallbackAnalysis(body.logs);
				});

				// Determine severity from AI response
				const severity = this.determineSeverity(body.logs, analysis);

				// Store in Durable Object
				const sentinel = env.SENTINEL_STATE.get(env.SENTINEL_STATE.idFromName('default'));
				const incident = await sentinel.storeIncident({
					timestamp: Date.now(),
					rawLogs: body.logs,
					analysis,
					severity,
				});

				return new Response(JSON.stringify(incident), {
					status: 200,
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				});
			}

			// Route: GET /incidents - retrieve incident history
			if (pathname === '/incidents' && request.method === 'GET') {
				const limitParam = url.searchParams.get('limit');
				const limit = limitParam ? Math.min(parseInt(limitParam), 100) : 50;

				const sentinel = env.SENTINEL_STATE.get(env.SENTINEL_STATE.idFromName('default'));
				const incidents = await sentinel.getIncidents(limit);

				return new Response(JSON.stringify({ incidents, count: incidents.length }), {
					status: 200,
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				});
			}

			// Route: GET /summary - get incident statistics
			if (pathname === '/summary' && request.method === 'GET') {
				const sentinel = env.SENTINEL_STATE.get(env.SENTINEL_STATE.idFromName('default'));
				const summary = await sentinel.getSummary();

				return new Response(JSON.stringify(summary), {
					status: 200,
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				});
			}

			// Route: GET / - serve static assets (handled automatically by wrangler)
			// Default response
			return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json', ...corsHeaders },
			});
		} catch (error) {
			console.error('Worker error:', error);
			return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
				status: 500,
				headers: { 'Content-Type': 'application/json', ...corsHeaders },
			});
		}
	},

	/**
	 * Call Llama 3.3 with system prompt tuned for root-cause analysis
	 */
	async analyzeLogsWithAI(logs: string, ai: Ai): Promise<string> {
		const systemPrompt = `You are a Senior Site Reliability Engineer (SRE) analyzing distributed system logs.
Your task is to perform rapid root-cause analysis:

1. Identify the PRIMARY FAILURE MODE (what failed first)
2. List CONTRIBUTING FACTORS (what made it worse)
3. Suggest IMMEDIATE MITIGATIONS (what to do NOW)
4. Recommend LONG-TERM FIXES (what to prevent recurrence)

Be concise and technical. Ignore benign logs. Focus on errors, timeouts, and cascading failures.
Output only actionable insights—no fluff.`;

		try {
			const response = (await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
				messages: [
					{
						role: 'system',
						content: systemPrompt,
					},
					{
						role: 'user',
						content: `Analyze these logs:\n\n${logs}`,
					},
				],
				max_tokens: 1024,
			})) as unknown;

			const analysis =
				typeof response === 'string'
					? response
					: ((response as { response?: string; result?: { response?: string } }).response ??
						(response as { response?: string; result?: { response?: string } }).result?.response);

			if (!analysis) {
				throw new Error('AI response did not contain analysis text');
			}

			return analysis;
		} catch (error) {
			console.error('AI inference error:', error);
			throw new Error(`AI inference failed: ${String(error)}`);
		}
	},

	/**
	 * Fallback analysis when AI provider is unavailable
	 */
	generateFallbackAnalysis(logs: string): string {
		const content = logs.toLowerCase();

		let primaryFailure = 'Unable to determine from logs';
		if (content.includes('panic') || content.includes('fatal')) {
			primaryFailure = 'Process crash/panic in one or more services';
		} else if (content.includes('timeout')) {
			primaryFailure = 'Timeout between dependent services';
		} else if (content.includes('error')) {
			primaryFailure = 'Application/runtime error detected';
		} else if (content.includes('warn')) {
			primaryFailure = 'Service degradation warning';
		}

		return [
			'Rapid Root-Cause Analysis (fallback mode)',
			'',
			`1. PRIMARY FAILURE MODE: ${primaryFailure}.`,
			'2. CONTRIBUTING FACTORS: Limited context due to AI upstream unavailability.',
			'3. IMMEDIATE MITIGATIONS: Inspect failing service logs, validate dependencies (DB/queue/network), and apply rollback if recent deploy introduced regressions.',
			'4. LONG-TERM FIXES: Add service-level alerting, retries with backoff, and structured logging with correlation IDs for faster triage.',
		].join('\n');
	},

	/**
	 * Determine severity level based on log patterns and AI analysis
	 */
	determineSeverity(logs: string, analysis: string): 'critical' | 'high' | 'medium' | 'low' {
		const logContent = `${logs} ${analysis}`.toLowerCase();

		if (logContent.includes('panic') || logContent.includes('fatal') || logContent.includes('critical') || logContent.includes('outage')) {
			return 'critical';
		}

		if (
			logContent.includes('error') ||
			logContent.includes('failure') ||
			logContent.includes('crashed') ||
			logContent.includes('timeout')
		) {
			return 'high';
		}

		if (logContent.includes('warn') || logContent.includes('degradation') || logContent.includes('slow')) {
			return 'medium';
		}

		return 'low';
	},
} satisfies ExportedHandler<Env>;
