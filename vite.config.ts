import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(() => {
	return {
		build: {
			outDir: "./.holix/client",
		},
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
				public: path.resolve(__dirname, "./public"),
			},
		},
		plugins: [
			tanstackRouter({
				target: "react",
				autoCodeSplitting: true,
				routesDirectory: "./src/routes",
				generatedRouteTree: "./src/routeTree.gen.ts",
			}),
			react(),
			tailwindcss(),
		],
		server: {
			port: 3456,
		},
	};
});
