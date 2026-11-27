import { runGeminiAnalysisWithMeta } from '../src/server/geminiAiServer';

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

    const messages = Array.isArray(parsed.messages)
      ? parsed.messages
      : [];

    const aiResult = await runGeminiAnalysisWithMeta(messages);

    if (aiResult.output) {
      return res.status(200).json({
        success: true,
        model: aiResult.model,
        aiOutput: aiResult.output,
      });
    }

    return res.status(200).json({
      success: false,
      fallback: true,
      quotaExhausted: Boolean(aiResult.quotaExhausted),
      notice: aiResult.notice,
    });

  } catch {
    return res.status(200).json({
      success: false,
      fallback: true,
      error: 'AI analysis service unavailable.',
    });
  }
}