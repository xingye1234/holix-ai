import { defineConfig } from 'tsdown' 

export default defineConfig({
	entry: "src/node/main.ts",
	outDir: "./.holix/main",
	target: "es2024",
	shims: true,
	platform: "node",
	publicDir: "public",
	alias: {
		"@": "./src",
		"public": "./public",
	},
	hooks: {
		"build:prepare": async (ctx) => {
			const isDev = ctx.options.watch;
			const DEV = isDev ? "true" : "false";
			const NODE_ENV = isDev ? "development" : "production";
			const BASE_URL = isDev ? "http://localhost:3456/" : "./client";
			ctx.options.env = {
				...ctx.options.env,
				DEV: DEV,
				NODE_ENV,
				BASE_URL,
			};
		},
	},
	loader: {
		".png": "dataurl",
	},
});