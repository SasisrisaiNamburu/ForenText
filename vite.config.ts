import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin, loadEnv } from 'vite';

function forenTextAiPlugin(): Plugin {
  return {
    name: 'forentext-ai-plugin',
    configureServer(server) {
      server.middlewares.use('/api/analyze-ai', async (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const parsed = JSON.parse(body || '{}');
              const messages = parsed.messages || [];
              const { runGeminiAnalysisWithMeta } = await import('./src/server/geminiAiServer');
              const aiResult = await runGeminiAnalysisWithMeta(messages);
              if (aiResult.output) {
                res.statusCode = 200;
                res.end(
                  JSON.stringify({
                    success: true,
                    model: aiResult.model,
                    aiOutput: aiResult.output,
                  })
                );
              } else {
                res.statusCode = 200;
                res.end(
                  JSON.stringify({
                    success: false,
                    fallback: true,
                    quotaExhausted: Boolean(aiResult.quotaExhausted),
                    notice: aiResult.notice,
                  })
                );
              }
            } catch (err: any) {
              res.statusCode = 200;
              res.end(JSON.stringify({ success: false, fallback: true, error: err?.message }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        }
      });
      server.middlewares.use('/api/translate-messages', async (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const parsed = JSON.parse(body || '{}');
              const items = Array.isArray(parsed.items) ? parsed.items : [];
              const { runGeminiTranslationsWithMeta } = await import('./src/server/geminiAiServer');
              const result = await runGeminiTranslationsWithMeta(items);
              if (result.translations.length > 0) {
                res.statusCode = 200;
                res.end(
                  JSON.stringify({
                    success: true,
                    model: result.model,
                    translations: result.translations,
                    notice: result.notice,
                  })
                );
              } else {
                res.statusCode = 200;
                res.end(
                  JSON.stringify({
                    success: false,
                    quotaExhausted: Boolean(result.quotaExhausted),
                    translations: [],
                    notice: result.notice || 'AI translation service unavailable.',
                  })
                );
              }
            } catch (err: any) {
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: false,
                  translations: [],
                  notice: err?.message || 'AI translation service unavailable.',
                })
              );
            }
          });
        } else {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  process.env.APP_URL = env.APP_URL;

  return {
    plugins: [react(), tailwindcss(), forenTextAiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
