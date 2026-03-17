import type { HolixProtocolRouter } from "@holix/router";
import type { AIProvider } from "@/types/provider";
import { Store } from "./store";

export interface ProviderData {
	providers: AIProvider[];
	defaultProvider?: string;
}

export class ProviderStore extends Store<ProviderData> {
	constructor() {
		super({
			name: "providers",
			defaultData: {
				providers: [
					{
						name: "OpenAI",
						baseUrl: "https://api.openai.com/v1",
						apiKey: "",
						apiType: "openai",
						models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
						enabled: false,
						avatar: "🤖",
					},
					{
						name: "Anthropic",
						baseUrl: "https://api.anthropic.com",
						apiKey: "",
						apiType: "anthropic",
						models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
						enabled: false,
						avatar: "🎭",
					},
					{
						name: "Google Gemini",
						baseUrl: "https://generativelanguage.googleapis.com/v1beta",
						apiKey: "",
						apiType: "gemini",
						models: ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"],
						enabled: false,
						avatar: "💎",
					},
					{
						name: "DeepSeek",
						baseUrl: "https://api.deepseek.com/v1",
						apiKey: "",
						apiType: "deepseek",
						models: ["deepseek-chat", "deepseek-reasoner"],
						enabled: false,
						avatar: "🌊",
					},
					{
						name: "Moonshot",
						baseUrl: "https://api.moonshot.cn/v1",
						apiKey: "",
						apiType: "moonshot",
						models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
						enabled: false,
						avatar: "🌙",
					},
					{
						name: "智谱AI",
						baseUrl: "https://open.bigmodel.cn/api/paas/v4",
						apiKey: "",
						apiType: "zhipu",
						models: ["glm-4-plus", "glm-4-air", "glm-4-flash"],
						enabled: false,
						avatar: "🧠",
					},
					{
						name: "阿里云百炼",
						baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
						apiKey: "",
						apiType: "qwen",
						models: ["qwen-max", "qwen-plus", "qwen-turbo"],
						enabled: false,
						avatar: "☁️",
					},
				],
				defaultProvider: undefined,
			},
			basePath: "providers",
		});
	}

	list(): AIProvider[] {
		return this.get("providers");
	}

	findByName(name: string): AIProvider | null {
		return this.list().find((p) => p.name === name) ?? null;
	}

	async add(provider: AIProvider) {
		const existing = this.findByName(provider.name);
		if (existing) {
			throw new Error(`Provider with name "${provider.name}" already exists`);
		}
		const arr = this.list();
		arr.push(provider);
		await this.set("providers", arr);
		return provider;
	}

	async update(name: string, updates: Partial<AIProvider>) {
		const arr = this.list();
		const idx = arr.findIndex((p) => p.name === name);
		if (idx === -1) return null;
		arr[idx] = { ...arr[idx], ...updates };
		await this.set("providers", arr);
		return arr[idx];
	}

	async remove(name: string) {
		const arr = this.list();
		const next = arr.filter((p) => p.name !== name);
		await this.set("providers", next);
	}

	async toggle(name: string, enabled: boolean) {
		return await this.update(name, { enabled });
	}

	use(router: HolixProtocolRouter) {
		const basePath = `/${this.basePath || this.name}`;

		router.get(basePath, async (ctx) => {
			ctx.json(this.list());
		});

		router.get(`${basePath}/default`, async (ctx) => {
			ctx.json(this.get("defaultProvider") || null);
		});

		router.post(`${basePath}/default`, async (ctx) => {
			const body = await ctx.req.json();
			await this.set("defaultProvider", body.name);
			ctx.json({ success: true });
		});

		router.get(`${basePath}/:name`, async (ctx) => {
			const rawName = (ctx.params && (ctx.params as any).name) ?? null;
			if (!rawName) return ctx.status(400).json({ error: "missing name" });
			const name = decodeURIComponent(rawName);
			const item = this.findByName(name);
			if (!item) return ctx.status(404).json({ error: "not found" });
			ctx.json(item);
		});

		router.post(basePath, async (ctx) => {
			const body = await ctx.req.json();
			try {
				const created = await this.add(body);
				ctx.json(created);
			} catch (err: any) {
				ctx.status(400).json({ error: err.message });
			}
		});

		router.put(`${basePath}/:name`, async (ctx) => {
			const rawName = (ctx.params && (ctx.params as any).name) ?? null;
			if (!rawName) return ctx.status(400).json({ error: "missing name" });
			const name = decodeURIComponent(rawName);
			const body = await ctx.req.json();
			const updated = await this.update(name, body);
			if (!updated) return ctx.status(404).json({ error: "not found" });
			ctx.json(updated);
		});

		router.delete(`${basePath}/:name`, async (ctx) => {
			const rawName = (ctx.params && (ctx.params as any).name) ?? null;
			if (!rawName) return ctx.status(400).json({ error: "missing name" });
			const name = decodeURIComponent(rawName);
			await this.remove(name);
			ctx.json({ success: true });
		});

		router.patch(`${basePath}/:name/toggle`, async (ctx) => {
			const rawName = (ctx.params && (ctx.params as any).name) ?? null;
			if (!rawName) return ctx.status(400).json({ error: "missing name" });
			const name = decodeURIComponent(rawName);
			const body = await ctx.req.json();
			const updated = await this.toggle(name, body.enabled ?? true);
			if (!updated) return ctx.status(404).json({ error: "not found" });
			ctx.json(updated);
		});
	}
}

export const providerStore = new ProviderStore();
