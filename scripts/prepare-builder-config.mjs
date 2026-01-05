import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readJSON(p) {
	return JSON.parse(readFileSync(p, "utf8"));
}

const pkgPath = join(root, "package.json");
const builderPath = join(root, "electron-builder.json");

if (!existsSync(pkgPath)) {
	throw new Error("package.json 不存在");
}

const pkg = readJSON(pkgPath);

// 原有 builder 配置（允许不存在）
const builderConfig = existsSync(builderPath) ? readJSON(builderPath) : {};

const deps = Object.keys(pkg.dependencies || {});

// 生成 files
const files = Array.from(new Set([...(builderConfig.files || []), ...deps.map((dep) => `node_modules/${dep}/**/*`)]));

const nextConfig = {
	...builderConfig,
	files,
};

writeFileSync(builderPath, JSON.stringify(nextConfig, null, 2));

console.log(
	`[builder] 已根据 ${deps.length} 个 dependencies 重写 electron-builder.json files`,
);
