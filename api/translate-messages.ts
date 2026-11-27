import { runGeminiTranslationsWithMeta } from '../src/server/geminiAiServer.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed',
    });
  }

  try {
    const parsed =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body || {};

    const items = Array.isArray(parsed.items)
      ? parsed.items
      : [];

    const result = await runGeminiTranslationsWithMeta(items);

    if (result.translations.length > 0) {
      return res.status(200).json({
        success: true,
        model: result.model,
        translations: result.translations,
        notice: result.notice,
      });
    }

    return res.status(200).json({
      success: false,
      quotaExhausted: Boolean(result.quotaExhausted),
      translations: [],
      notice: result.notice || 'AI translation service unavailable.',
    });

  } catch {
    return res.status(200).json({
      success: false,
      translations: [],
      notice: 'AI translation service unavailable.',
    });
  }
}