import { defineConfig } from "vite";

export default defineConfig({
    root: "./src",
    build: {
        outDir: "../site",
        emptyOutDir: true,
        rollupOptions: {
            input: {
                input: "src/index.html"
            }
        }
    }
});
