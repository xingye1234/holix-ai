import type { HolixProtocolRouter } from "@holix/router";
import { BrowserWindow } from "electron";
import { resolve } from "pathe";
import logo from "public/logo.png";
import { configStore } from "./config";
import { update } from "./update";

const minWidth = 800;
const minHeight = 540;

const isMacOS = process.platform === "darwin";

export class AppWindow extends BrowserWindow {
	constructor() {
		const { width, height } = configStore.get("window");
		super({
			width: width,
			height: height,
			minWidth,
			minHeight,
			show: false,
			frame: import.meta.env.DEV,
			trafficLightPosition: { x: 10, y: 16 },
			icon: resolve(import.meta.dirname, logo),
			titleBarStyle: isMacOS ? 'hiddenInset' : 'default',
		});

		this.on("resized", async () => {
			const [width, height] = this.getSize();
			await configStore.set("window", { width, height });
		});

		// Window state change events -> send updates to renderer via orchestrator.update
		this.on("minimize", () => {
			update("window.minimize", {});
		});

		this.on("maximize", () => {
			update("window.maximize", { maximized: true });
		});

		this.on("unmaximize", () => {
			update("window.maximize", { maximized: false });
		});

		this.on("close", () => {
			update("window.close", {});
		});
	}

	use(router: HolixProtocolRouter) {
		router.post("/window/:action", async (ctx, next) => {
			const action = ctx.params.action;
			if (action === "minimize") {
				this.minimize();
			}

			if (action === "maximize") {
				if (this.isMaximized()) {
					this.unmaximize();
				} else {
					this.maximize();
				}
			}

			if (action === "close") {
				this.close();
			}

			next();
			return;
		});
	}

	showWhenReady() {
		return new Promise<void>((resolve) => {
			// const currentChatId = configStore.get("currentChatId");

			const url = import.meta.env.DEV
				? import.meta.env.BASE_URL
				: "holix://app/";

			// if (currentChatId) {
			// 	url = url.concat(`chat/${currentChatId}`);
			// }

			console.log("Loading URL:", url);

			import.meta.env.DEV ? this.loadURL(url) : this.loadURL(url);

			this.webContents.openDevTools({ mode: "right" });

			this.once("ready-to-show", () => {
				this.show();
				resolve();
			});
		});
	}
}
