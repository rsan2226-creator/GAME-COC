import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: 'v1beta',
  httpOptions: {
    apiVersion: 'v1beta',
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// In-memory TTS audio cache
const ttsCache = new Map<string, { audioBase64: string; mimeType: string }>();

// Circuit breaker when Free Tier daily TTS quota (10 req/day) is exhausted
let ttsQuotaCooldownUntil = 0;

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded');
}

async function synthesizeGeminiSpeech(
  cleanText: string,
  selectedVoice: string
): Promise<{ audioBase64: string; mimeType: string } | null> {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
    return null;
  }

  // If quota circuit breaker is active, immediately use client Web Speech synthesis without hitting API
  if (Date.now() < ttsQuotaCooldownUntil) {
    return null;
  }

  const modelsToTry = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [{ text: cleanText }],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (inlineData?.data) {
        return {
          audioBase64: inlineData.data,
          mimeType: inlineData.mimeType || 'audio/wav',
        };
      }
    } catch (err: unknown) {
      if (isQuotaError(err)) {
        // If both models hit free tier quota, activate cooldown for 15 minutes to avoid 429 spam
        if (modelName === modelsToTry[modelsToTry.length - 1]) {
          ttsQuotaCooldownUntil = Date.now() + 15 * 60 * 1000;
        }
        continue;
      }
      break;
    }
  }

  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  // Endpoint 1: Generate AI Moderator Speech (with automatic quota circuit-breaker & fallback)
  app.post('/api/moderator/speak', async (req, res) => {
    try {
      const { text, voiceName = 'Kore' } = req.body || {};

      if (!text || typeof text !== 'string' || !text.trim()) {
        res.json({
          audioBase64: null,
          useBrowserFallback: true,
        });
        return;
      }

      const cleanText = text.trim();
      const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
      const selectedVoice = validVoices.includes(voiceName) ? voiceName : 'Kore';

      const cacheKey = `${selectedVoice}::${cleanText}`;
      const cached = ttsCache.get(cacheKey);
      if (cached) {
        res.json({
          audioBase64: cached.audioBase64,
          mimeType: cached.mimeType,
          cached: true,
        });
        return;
      }

      const synthesized = await synthesizeGeminiSpeech(cleanText, selectedVoice);

      if (!synthesized) {
        res.json({
          audioBase64: null,
          mimeType: 'audio/wav',
          useBrowserFallback: true,
          quotaCooldownActive: Date.now() < ttsQuotaCooldownUntil,
        });
        return;
      }

      if (ttsCache.size >= 150) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey) ttsCache.delete(firstKey);
      }
      ttsCache.set(cacheKey, synthesized);

      res.json({
        audioBase64: synthesized.audioBase64,
        mimeType: synthesized.mimeType,
        cached: false,
      });
    } catch {
      res.json({
        audioBase64: null,
        useBrowserFallback: true,
      });
    }
  });

  // Endpoint 2: Generate Dynamic AI Moderator Commentary + Speech
  app.post('/api/moderator/commentary', async (req, res) => {
    try {
      const { eventType, contextData, voiceName = 'Kore' } = req.body || {};

      let generatedScript =
        'Pertandingan Class of Champions PJOK Atletik Kelas 4 Fase B berlangsung semakin seru!';

      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
        try {
          const prompt = `Kamu adalah Moderator AI resmi acara kompetisi akademik bergengsi "CLASS OF CHAMPIONS" untuk mata pelajaran PJOK, Materi ATLETIK, Kelas 4 / Fase B.
Buat 1 hingga 2 kalimat komentar moderator dalam bahasa Indonesia yang sangat seru, antusias, dramatis, sopan, dan memotivasi siswa di kelas berdasarkan kejadian berikut:
Jenis Kejadian: ${eventType}
Detail Konteks: ${JSON.stringify(contextData || {})}

Aturan:
- Langsung tuliskan kalimat yang akan diucapkan oleh moderator tanpa tanda kutip dan tanpa label pembicara.
- Maksimal 28 kata agar cepat dan padat saat diucapkan.`;

          const textResponse = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
          });

          if (textResponse.text?.trim()) {
            generatedScript = textResponse.text.trim();
          }
        } catch {
          // silently fallback to default script
        }
      }

      const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
      const selectedVoice = validVoices.includes(voiceName) ? voiceName : 'Kore';

      const synthesized = await synthesizeGeminiSpeech(generatedScript, selectedVoice);

      res.json({
        script: generatedScript,
        audioBase64: synthesized?.audioBase64 || null,
        mimeType: synthesized?.mimeType || 'audio/wav',
        useBrowserFallback: !synthesized,
        quotaCooldownActive: Date.now() < ttsQuotaCooldownUntil,
      });
    } catch {
      res.json({
        script:
          'Pertandingan Class of Champions PJOK Atletik Kelas 4 Fase B berlangsung semakin seru!',
        audioBase64: null,
        useBrowserFallback: true,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Class of Champions Server running on http://localhost:${PORT}`);
  });
}

startServer();
