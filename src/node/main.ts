import { resolve } from "node:path";
import { createRouter } from "@holix/router";
import { createStaticMiddleware } from "@holix/static";
import { app, protocol } from "electron";
import { initChat } from "./chat/init";
import { SCHEME } from "./constant";
import { migrateDb } from "./database/connect";
import { createChannel } from "./platform/channel";
import { onCommandForClient } from "./platform/commands";
import { configStore } from "./platform/config";
import { logger } from "./platform/logger";
import { providerStore } from "./platform/provider";
import { AppWindow } from "./platform/window";
import { trpcRouter } from "./server/handler";

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

protocol.registerSchemesAsPrivileged([
	{
		scheme: SCHEME,
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
			corsEnabled: true,
			allowServiceWorkers: true,
		},
	},
]);

const router = createRouter();
configStore.use(router);
providerStore.use(router);
onCommandForClient(router);
trpcRouter(router);
router.get("/channel", createChannel());

if (import.meta.env.PROD) {
	router.use(
		createStaticMiddleware({
			root: resolve(import.meta.dirname, "../client"),
			prefix: "/",
			ignorePaths: ["/api/**", "/channel/**", '/trpc/**', "/command/**", "/config/**", "/providers/**", "/window/**"],
		}),
	);
}

let window: AppWindow | null = null;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
	app.quit();
}

app.on("second-instance", () => {
	logger.info(
		"Second instance detected. Bringing the main window to the front.",
	);
	if (window?.isMinimized()) {
		window?.restore();
	}
	window?.focus();
});

async function bootstrap() {
	await app.whenReady();
	initChat();
	await configStore.init();
	await providerStore.init();
	window = new AppWindow();
	router.register(window.webContents.session.protocol);
	window.use(router);

	await window.showWhenReady();
}

migrateDb();
bootstrap().catch((err) => {
	logger.error("Failed to setup application:", err);
});
