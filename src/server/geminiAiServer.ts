/**
 * ForenText Server-Side Gemini AI Forensic Analysis Utility
 * Uses @google/genai SDK with gemini-4-hydrogen (and gemini-3.1-flash-lite fallback)
 * Adheres to server-side only execution guidelines and telemetry headers.
 */

import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export interface AIMessageInput {
  id: number;
  sender: string;
  text: string;
  timestamp: string;
}

export interface AIAnalysisOutput {
  insights: {
    messageId: number;
    contextualRisk: 'critical' | 'elevated' | 'needs_review' | 'contextual' | 'informational';
    intentCategory: string;
    explanation: string;
    indirectReferences: string[];
    disagreementWithKeyword?: string;
  }[];
  entities: {
    messageId: number;
    text: string;
    category: 'Person' | 'Location' | 'Vehicle' | 'Object' | 'Document' | 'DateTime';
    interpretation: string;
    confidence: 'high' | 'medium';
  }[];
  suggestedCorrelations: {
    sourceId: number;
    targetId: number;
    relationshipType: string;
    rationale: string;
  }[];
  summary: string;
}

export const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
export const FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';

export interface ServerAIResult {
  output: AIAnalysisOutput | null;
  model?: string;
  quotaExhausted?: boolean;
  notice?: string;
}

function isQuotaOrRateLimitError(err: unknown): { is429: boolean; isDailyQuota: boolean } {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const status = (err as { status?: number; code?: number })?.status ?? (err as { code?: number })?.code;
  const is429 = status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
  const isDailyQuota = msg.includes('PerDay') || msg.includes('free_tier_requests');
  return { is429, isDailyQuota };
}

async function callModelWithTimeout(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  timeoutMs = 15000
): Promise<AIAnalysisOutput | null> {
  const apiPromise = ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      systemInstruction:
        'You are an impartial digital forensics analyst. Use neutral, objective language. Do not assert legal guilt. Base every finding strictly on the provided transcript.',
      ...(model === PRIMARY_GEMINI_MODEL
        ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
        : {}),
    },
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Gemini request timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  const response = await Promise.race([apiPromise, timeoutPromise]);
  const text = response.text;
  if (!text) return null;

  return JSON.parse(text) as AIAnalysisOutput;
}

export async function runGeminiAnalysisWithMeta(
  messages: AIMessageInput[]
): Promise<ServerAIResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return { output: null };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const conversationExcerpt = messages
    .slice(0, 40)
    .map((m) => `[ID:${m.id}] ${m.timestamp} - ${m.sender}: "${m.text}"`)
    .join('\n');

  const prompt = `You are ForenText AI, a digital forensics investigative intelligence assistant.
Analyze ONLY the following standalone messaging export transcript using contextual natural language understanding:

${conversationExcerpt}

Perform a rigorous, strictly transcript-grounded forensic evaluation:
1. Priority classification:
   - "critical": Explicit severe threat, weapon staging, serious violence/extortion, or clear illicit operational directive.
   - "elevated": Anti-forensics tampering, sensitive document custody transfer, suspicious unattended object drop-off, or multi-factor operational staging.
   - "needs_review": Discreet, indirect, or ambiguous suspicious observations across English, Hindi (Devanagari), Roman Hindi, or Hinglish—such as repeated unknown/unfamiliar numbers, unrecognised individuals waiting or lingering, watching/staring/following behavior, sender intuition/unease ("something felt off", "kuch ajeeb laga"), unexplained bags/packages, unusual vehicle activity, or secrecy requests ("don't tell anyone", "kisi ko mat batana"). Keep descriptions neutral and non-accusatory.
   - "informational": Benign usage or false-positive disambiguation (birthday cake knives, cinema dialogue, figurative idioms, ordinary routine parcel/food deliveries, or mundane passerby remarks). Do NOT flag ordinary casual chat as suspicious.
2. Strict evidence & correlation rules:
   - Treat this transcript as 100% independent. NEVER extrapolate or introduce external locations, people, vehicles, or prior event stories not explicitly written above.
   - ONLY suggest correlations in "suggestedCorrelations" when two messages are genuinely linked by a shared specific entity (person, specific place, vehicle plate/model, document) or an explicit conversational reply/continuation. NEVER correlate messages solely because both contain single generic words ("station", "bag", "car", "package", "meeting") or merely because two unrelated locations appear close in time.
3. Note any disagreements with simple keyword searches (where a keyword alone would falsely flag benign context or miss indirect cues).

Return ONLY a valid JSON object matching this exact schema:
{
  "insights": [
    {
      "messageId": number,
      "contextualRisk": "critical" | "elevated" | "needs_review" | "contextual" | "informational",
      "intentCategory": string,
      "explanation": string,
      "indirectReferences": string[],
      "disagreementWithKeyword": string (optional explanation if simple keyword matching would disagree)
    }
  ],
  "entities": [
    {
      "messageId": number,
      "text": string,
      "category": "Person" | "Location" | "Vehicle" | "Object" | "Document" | "DateTime",
      "interpretation": string,
      "confidence": "high" | "medium"
    }
  ],
  "suggestedCorrelations": [
    {
      "sourceId": number,
      "targetId": number,
      "relationshipType": string,
      "rationale": string
    }
  ],
  "summary": string
}`;

  try {
    const output = await callModelWithTimeout(ai, PRIMARY_GEMINI_MODEL, prompt, 15000);
    return { output, model: PRIMARY_GEMINI_MODEL };
  } catch (err) {
    const { is429, isDailyQuota } = isQuotaOrRateLimitError(err);

    if (is429 && !isDailyQuota) {
      // Transient per-minute rate limit: brief backoff retry once
      await new Promise((r) => setTimeout(r, 800));
      try {
        const retryOutput = await callModelWithTimeout(ai, PRIMARY_GEMINI_MODEL, prompt, 15000);
        return { output: retryOutput, model: PRIMARY_GEMINI_MODEL };
      } catch {
        // Fall through to lighter fallback model
      }
    }

    try {
      const fallbackOutput = await callModelWithTimeout(ai, FALLBACK_GEMINI_MODEL, prompt, 12000);
      return { output: fallbackOutput, model: FALLBACK_GEMINI_MODEL };
    } catch (fallbackErr) {
      const fallbackRate = isQuotaOrRateLimitError(fallbackErr);
      if (is429 || fallbackRate.is429) {
        return {
          output: null,
          quotaExhausted: true,
          notice:
            'Gemini API quota exhausted; using local deterministic contextual engine. Upgrading to a billing-enabled API key in Settings > Secrets increases quota.',
        };
      }

      return {
        output: null,
        notice: 'Gemini service unavailable; using local deterministic contextual engine.',
      };
    }
  }
}

export async function runGeminiAnalysis(
  messages: AIMessageInput[]
): Promise<AIAnalysisOutput | null> {
  const res = await runGeminiAnalysisWithMeta(messages);
  return res.output;
}

export interface AITranslationInput {
  id: number;
  text: string;
  detectedLanguage: 'hindi_devanagari' | 'roman_hindi' | 'hinglish';
}

export interface AITranslationItem {
  messageId: number;
  englishTranslation: string;
}

export interface ServerTranslationResult {
  translations: AITranslationItem[];
  model?: string;
  quotaExhausted?: boolean;
  notice?: string;
}

async function callTranslationModelWithTimeout(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  timeoutMs = 15000
): Promise<AITranslationItem[]> {
  const apiPromise = ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          translations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                messageId: { type: Type.INTEGER },
                englishTranslation: { type: Type.STRING },
              },
              required: ['messageId', 'englishTranslation'],
            },
          },
        },
        required: ['translations'],
      },
      systemInstruction:
        'You are a precise digital forensics translator. Translate Hindi (Devanagari), Roman Hindi, and mixed Hindi-English (Hinglish) chat messages faithfully into natural, neutral English. Preserve all person names, place names, vehicle numbers, phone numbers, dates, and quoted identifiers accurately. Never invent information not present in the original message.',
      ...(model === PRIMARY_GEMINI_MODEL
        ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
        : {}),
    },
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Gemini translation timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  const response = await Promise.race([apiPromise, timeoutPromise]);
  const text = response.text;
  if (!text) return [];
  const parsed = JSON.parse(text) as { translations?: AITranslationItem[] };
  return Array.isArray(parsed?.translations) ? parsed.translations : [];
}


export async function runGeminiTranslationsWithMeta(
  items: AITranslationInput[]
): Promise<ServerTranslationResult> {
  if (!items || items.length === 0) {
    return { translations: [] };
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return {
      translations: [],
      notice: 'Gemini API key unavailable; English translation could not be generated.',
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Log diagnostic details without exposing evidence or API credentials.
  const logTranslationError = (
    stage: string,
    model: string,
    err: unknown
  ) => {
    const error = err as {
      status?: number;
      code?: number | string;
      message?: string;
    };

    const rawMessage =
      err instanceof Error
        ? err.message
        : String(error?.message || err || 'Unknown error');

    const safeMessage = rawMessage.split(apiKey).join('[REDACTED]');

    console.error('[ForenText Translation Diagnostic]', {
      stage,
      model,
      status: error?.status ?? null,
      code: error?.code ?? null,
      message: safeMessage,
      quotaClassification: isQuotaOrRateLimitError(err),
    });
  };

  const batchSize = 25;
  const allTranslations: AITranslationItem[] = [];
  let resolvedModel: string | undefined;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const formatted = batch
      .map(
        (item) =>
          `[ID:${item.id} | Script/Lang:${item.detectedLanguage}] ${JSON.stringify(item.text)}`
      )
      .join('\n');

    const prompt = `Translate each of the following chat messages faithfully into clear English.
Rules:
- Messages may be written in Hindi (Devanagari script), Roman Hindi (Hindi written in English/Latin letters, including spelling variations like "nhi", "krna", "btao"), or Hinglish (mixed Hindi and English).
- Translate the full meaning accurately into English while keeping proper names, places, vehicle plates, dates, times, and numbers intact.
- Preserve multiline intent and do not add commentary or assumptions.
- Return an entry for every message ID provided.

Messages:
${formatted}`;

    try {
      const batchResult = await callTranslationModelWithTimeout(
        ai,
        PRIMARY_GEMINI_MODEL,
        prompt,
        15000
      );

      resolvedModel = PRIMARY_GEMINI_MODEL;
      allTranslations.push(...batchResult);
    } catch (err) {
      logTranslationError('Primary model failed', PRIMARY_GEMINI_MODEL, err);

      const { is429, isDailyQuota } = isQuotaOrRateLimitError(err);

      if (is429 && !isDailyQuota) {
        await new Promise((r) => setTimeout(r, 800));

        try {
          const retryResult = await callTranslationModelWithTimeout(
            ai,
            PRIMARY_GEMINI_MODEL,
            prompt,
            15000
          );

          resolvedModel = PRIMARY_GEMINI_MODEL;
          allTranslations.push(...retryResult);
          continue;
        } catch (retryErr) {
          logTranslationError(
            'Primary model retry failed',
            PRIMARY_GEMINI_MODEL,
            retryErr
          );
        }
      }

      try {
        const fallbackResult = await callTranslationModelWithTimeout(
          ai,
          FALLBACK_GEMINI_MODEL,
          prompt,
          12000
        );

        resolvedModel = resolvedModel || FALLBACK_GEMINI_MODEL;
        allTranslations.push(...fallbackResult);
      } catch (fallbackErr) {
        logTranslationError(
          'Fallback model failed',
          FALLBACK_GEMINI_MODEL,
          fallbackErr
        );

        const fallbackRate = isQuotaOrRateLimitError(fallbackErr);

        return {
          translations: allTranslations,
          quotaExhausted: is429 || fallbackRate.is429,
          notice:
            is429 || fallbackRate.is429
              ? 'Gemini API quota exhausted; AI translation is currently unavailable.'
              : 'AI translation service unavailable; original messages preserved without translation.',
        };
      }
    }
  }

  return {
    translations: allTranslations,
    model: resolvedModel,
  };
}

