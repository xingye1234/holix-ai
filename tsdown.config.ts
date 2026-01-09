import { defineConfig } from 'tsdown' 
import pkg from './package.json'

export default defineConfig({
	entry: "src/node/main.ts",
	outDir: "dist/main",
	target: "node20",
	external: [
		...Object.keys(pkg.dependencies || {}),
		...Object.keys(pkg.devDependencies || {}),
	],
	shims: true,
	loader: {
		".png": 'dataurl',
	}
});