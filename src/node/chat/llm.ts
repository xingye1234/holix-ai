import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import { inferProvider } from "../../share/models";

export interface LlmConfig {
	apiKey?: string;
	baseURL?: string;
	temperature?: number;
	maxTokens?: number;
	streaming?: boolean;
	provider?: string;
}

export function createLlm(model: string, config?: LlmConfig) {
	const provider = config?.provider?.toLowerCase() || inferProvider(model);

	if (!provider) {
		throw new Error(`Cannot infer provider for model: ${model}`);
	}

	if (provider === "anthropic") {
		return createAnthropicAdapter(model, config)
	}

	if (provider === "gemini") {
		return createGeminiAdapter(model, config)
	}

	if (provider === "ollama") {
		return createOllamaAdapter(model, config)
	}

	// 智谱AI、DeepSeek、Moonshot、Qwen 都使用 OpenAI 兼容接口
	if (provider === "zhipu" || provider === "智谱ai" || provider === "deepseek" || provider === "moonshot" || provider === "qwen" || provider === "阿里云百炼" || provider === "openai") {
		return createOpenAIAdapter(model, config)
	}

	// 默认使用 OpenAI 适配器
	return createOpenAIAdapter(model, config)
}

function createAnthropicAdapter(model: string, config?: LlmConfig) {
	return new ChatAnthropic({
		modelName: model,
		temperature: config?.temperature ?? 0.7,
		maxTokens: config?.maxTokens,
		apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY,
		// 指定 Base URL（用于自定义端点或代理）
		clientOptions: {
			baseURL: config?.baseURL || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
		},
	});
}

function createOpenAIAdapter(model: string, config?: LlmConfig) {
	return new ChatOpenAI({
		modelName: model,
		temperature: config?.temperature ?? 0.7,
		maxTokens: config?.maxTokens,
		streaming: config?.streaming ?? true,
		// 指定 API Key
		apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
		// 指定 Base URL（用于自定义端点或代理）
		configuration: {
			baseURL:
				config?.baseURL ||
				process.env.OPENAI_BASE_URL ||
				"https://api.openai.com/v1",
		},
	});
}

function createGeminiAdapter(model: string, config?: LlmConfig) {
	return new ChatGoogleGenerativeAI({
		model: model,
		temperature: config?.temperature ?? 0.7,
		maxOutputTokens: config?.maxTokens,
		apiKey: config?.apiKey || process.env.GOOGLE_API_KEY,
		// 指定 Base URL（用于自定义端点或代理）
		baseUrl: config?.baseURL || process.env.GOOGLE_BASE_URL,
	});
}

function createOllamaAdapter(model: string, config?: LlmConfig) {
	return new ChatOllama({
		model: model,
		temperature: config?.temperature ?? 0.7,
		numCtx: config?.maxTokens,
		// Ollama 通常运行在本地
		baseUrl: config?.baseURL || process.env.OLLAMA_BASE_URL || "http://localhost:11434",
	});
}