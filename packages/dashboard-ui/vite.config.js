import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// ESM equivalent of __dirname
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
export default defineConfig(function (_a) {
    var mode = _a.mode;
    // Load all env vars (not just VITE_ prefixed) for config use
    var env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react()],
        resolve: {
            alias: {
                // Use absolute path as per Vite best practices
                '@': resolve(__dirname, './src'),
            },
        },
        server: {
            port: 5173,
            proxy: {
                '/api': {
                    target: "http://localhost:".concat(env.VITE_API_PORT || '4006'),
                    changeOrigin: true,
                },
            },
        },
    };
});
