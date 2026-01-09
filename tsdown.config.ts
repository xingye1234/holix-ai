import { defineConfig } from 'tsdown'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

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
		"build:done": async (ctx) => {
			const isDev = ctx.options.watch;
			if (isDev) {
				// 开发模式下不更新 electron-builder.json
				return;
			}

			const deps =  ctx.chunks.map((chunk) => {
				return (
					chunk as {
						imports: string[];
					}
				).imports.filter((imp) => !imp.startsWith("node:"));
			});

			const uniqueDeps = Array.from(new Set(deps)).flat();

			console.log("External Node.js dependencies:", uniqueDeps);

			// 更新 electron-builder.json
			await updateElectronBuilderFiles(uniqueDeps);
		}
	},
	loader: {
		".png": "dataurl",
	},
});

/**
 * 更新 electron-builder.json 文件的 files 字段
 * @param deps 依赖包名称数组
 */
async function updateElectronBuilderFiles(deps: string[]) {
	const electronBuilderPath = join(process.cwd(), "electron-builder.json");

	try {
		// 读取 electron-builder.json
		const content = await readFile(electronBuilderPath, "utf-8");
		const config = JSON.parse(content);

		// 生成 node_modules 依赖路径
		const depFiles = deps.map((dep) => `node_modules/${dep}/**/*`);

		// 保留其他非 node_modules 的文件配置
		const otherFiles = (config.files || []).filter(
			(file: string) => !file.startsWith("node_modules/"),
		);

		// 合并配置
		config.files = [...otherFiles, ...depFiles];

		// 写回文件
		await writeFile(
			electronBuilderPath,
			JSON.stringify(config, null, 2) + "\n",
			"utf-8",
		);

		console.log(
			`✓ Updated electron-builder.json with ${deps.length} dependencies`,
		);
	} catch (error) {
		console.error("Failed to update electron-builder.json:", error);
	}
}