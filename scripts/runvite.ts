import { execa } from "execa";



export const runVite = async () => {
	execa`vite dev`
}