import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { createHighlighter, createOnigurumaEngine } from "shiki";


export const shiki = await createHighlighter({
	themes: ["github-dark", "github-light"],
	langs: [
		"ts",
		"tsx",
		"js",
		"jsx",
		"json",
		"bash",
		"go",
		"rust",
		"python",
		"java",
		"css",
		"html",
		"markdown",
		"vue",
		"html",
		"astro",
		"bash",
		"c",
		"cpp",
	],
	engine: createOnigurumaEngine(() => import('shiki/wasm'))
});


export const rehypeShiki = [
	rehypeShikiFromHighlighter,
	shiki,
	{
		themes: {
			light: "github-light",
			dark: "github-dark",
		},
	}
] as const;