import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));

// Lazy initialization of Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Health endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Aksharam Backend',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Direct project zip download endpoint
app.get('/api/download-zip', (req: Request, res: Response) => {
  const zipPath = path.join(process.cwd(), 'public', 'aksharam.zip');
  if (fs.existsSync(zipPath)) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="aksharam.zip"');
    res.download(zipPath, 'aksharam.zip');
  } else {
    res.status(404).json({ error: 'Zip file not found' });
  }
});

// Helper: decode HTML entities that might be returned by translation APIs
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Fallback neural machine translation using public translation service
async function translateWithNeuralMachine(text: string, sourceLang = 'en'): Promise<string> {
  const langCode = sourceLang === 'auto' ? 'en' : sourceLang;
  const langPair = `${langCode}|ml`;

  // Split by newlines to preserve formatting
  const lines = text.split('\n');
  const translatedLines: string[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      translatedLines.push('');
      continue;
    }

    // If already Malayalam Unicode, preserve it
    if (/^[\u0D00-\u0D7F\s\d.,!?'"()-]+$/.test(line)) {
      translatedLines.push(line);
      continue;
    }

    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(line)}&langpair=${encodeURIComponent(langPair)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MalayalamWriter/1.0)',
        },
      });

      if (!response.ok) {
        translatedLines.push(line);
        continue;
      }

      const data = await response.json();
      if (data?.responseData?.translatedText) {
        translatedLines.push(decodeHtmlEntities(data.responseData.translatedText));
      } else {
        translatedLines.push(line);
      }
    } catch {
      translatedLines.push(line);
    }
  }

  return translatedLines.join('\n');
}

// Translation endpoint
app.post('/api/translate', async (req: Request, res: Response) => {
  try {
    const { text, sourceLanguage = 'auto', targetLanguage = 'ml' } = req.body;

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text is required for translation' });
      return;
    }

    const ai = getGeminiClient();

    const targetLangName = targetLanguage === 'en' ? 'English' : targetLanguage === 'hi' ? 'Hindi' : 'Malayalam';
    const sourceLangName = sourceLanguage === 'auto' ? 'whatever language is detected' : sourceLanguage === 'ml' ? 'Malayalam' : sourceLanguage === 'en' ? 'English' : sourceLanguage;

    // 1. If Gemini AI is configured, attempt high-fidelity translation
    if (ai) {
      const prompt = `You are a professional translator and linguist specializing in Indian languages and Malayalam.
Translate the following text from ${sourceLangName} into ${targetLangName}.
Follow these strict rules:
1. Output ONLY the translated ${targetLangName} text.
2. Do not include any conversational pleasantries, explanations, or meta-commentary.
3. Preserve original paragraph breaks, bullet points, numbers, and punctuation.
4. Ensure idiomatic, culturally natural grammar and correct spellings.

Text to translate:
"""
${text}
"""`;

      // Try fast, responsive model gemini-3.1-flash-lite, fallback to gemini-3.8-flash
      const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
          });

          const translatedText = response.text ? response.text.trim() : '';
          if (translatedText) {
            res.json({
              translatedText,
              detectedLanguage: sourceLanguage === 'auto' ? 'Auto Detected' : sourceLanguage,
              provider: `Google Gemini (${modelName})`,
              isFallback: false,
            });
            return;
          }
        } catch (geminiErr) {
          console.warn(`Gemini translation with ${modelName} failed or busy, trying next option...`, geminiErr);
        }
      }
    }

    // 2. Automatic Fallback: Neural Machine Translation (MyMemory API)
    console.log('Using Neural Machine Translation service fallback...');
    const fallbackText = await translateWithNeuralMachine(text, sourceLanguage);

    if (fallbackText && fallbackText.trim()) {
      res.json({
        translatedText: fallbackText,
        detectedLanguage: sourceLanguage === 'auto' ? 'Auto Detected' : sourceLanguage,
        provider: 'Neural Machine Translation (Cloud)',
        isFallback: !ai,
      });
      return;
    }

    // 3. If all external networks failed, return graceful response
    res.json({
      translatedText: text,
      detectedLanguage: sourceLanguage === 'auto' ? 'English' : sourceLanguage,
      provider: 'Local Passthrough',
      isFallback: true,
    });
  } catch (err: unknown) {
    console.error('Translation route error:', err);
    res.status(500).json({
      error: 'Translation request failed',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// OCR extraction endpoint
app.post('/api/ocr', async (req: Request, res: Response) => {
  try {
    const { base64Data, mimeType = 'image/jpeg', filename = 'document' } = req.body;

    if (!base64Data) {
      res.status(400).json({ error: 'base64Data is required' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.json({
        text: `ഫയൽ: ${filename}\n(OCR സേവനം പൂർണ്ണമായി ലഭ്യമാക്കാൻ Settings-ൽ Gemini API Key ക്രമീകരിക്കുക)`,
        detectedLanguage: 'Malayalam/English',
        provider: 'Mock OCR (Awaiting API Key)',
        isFallback: true,
      });
      return;
    }

    const imagePart = {
      inlineData: {
        mimeType: mimeType.includes('pdf') ? 'application/pdf' : mimeType,
        data: base64Data,
      },
    };

    const textPart = {
      text: `Carefully examine this document or image and transcribe all readable text verbatim.
Follow these guidelines:
1. Maintain accurate Malayalam Unicode typography (മലയാളം അക്ഷരങ്ങൾ, കൂട്ടക്ഷരങ്ങൾ, ചില്ലക്ഷരങ്ങൾ).
2. Transcribe English text and numerical digits accurately.
3. Preserve layout headings, paragraphs, and list items.
4. Return ONLY the extracted text content without commentary.`,
    };

    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    let extractedText = '';
    let usedModel = 'gemini-3.1-flash-lite';

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: { parts: [imagePart, textPart] },
        });
        if (response.text) {
          extractedText = response.text.trim();
          usedModel = model;
          break;
        }
      } catch (ocrErr) {
        console.warn(`OCR with ${model} failed, trying alternative...`, ocrErr);
      }
    }

    res.json({
      text: extractedText || `ഫയൽ ${filename} പരിശോധിച്ച് ഉള്ളടക്കം തിരിച്ചറിയാൻ കഴിഞ്ഞില്ല.`,
      detectedLanguage: /[\u0D00-\u0D7F]/.test(extractedText) ? 'Malayalam' : 'English',
      provider: `Gemini Multimodal OCR (${usedModel})`,
      isFallback: false,
    });
  } catch (err: unknown) {
    console.error('OCR error:', err);
    res.status(500).json({
      error: 'OCR processing failed',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// Vite middleware in dev or static serving in production
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Malayalam Writer server listening on http://0.0.0.0:${PORT}`);
  });
}

setupVite();
