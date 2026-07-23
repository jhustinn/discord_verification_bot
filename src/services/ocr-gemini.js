// ─── OCR Service with Gemini Vision (Free, No Credit Card) ────────────────────
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

let genAI = null;

function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not set');
    }
    genAI = new GoogleGenerativeAI(apiKey);
    logger.info('OCR', 'Gemini AI initialized');
  }
  return genAI;
}

async function processImage(imageBuffer) {
  try {
    logger.info('OCR', 'Starting Gemini Vision processing...');

    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');

    const prompt = `Analyze this game screenshot from Modern Warships. Extract the following information EXACTLY as shown in the image, preserving ALL special characters, Unicode characters, and symbols:

1. Player Name: (the name shown after the clan tag in brackets, preserve any special characters like Greek letters Ψ, Ω, Σ, etc.)
2. Player ID: (hexadecimal ID shown in the profile)
3. Player Level: (the number before "Level")

Important rules:
- Preserve ALL special characters EXACTLY as they appear
- If you see Greek letters (Ψ, Ω, Σ, etc.), keep them as-is
- Return ONLY the extracted data in this exact format:
NAME: [exact player name]
ID: [player id]
LEVEL: [level number]

If any field is not found, use "NOT_FOUND" for that field.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/png',
          data: base64Image
        }
      }
    ]);

    const response = result.response;
    const text = response.text();

    logger.info('OCR', 'Gemini response received', { text });

    const extractedData = parseGeminiResponse(text);

    return {
      success: true,
      rawText: text,
      data: extractedData
    };
  } catch (error) {
    logger.error('OCR', 'Gemini processing error', { error: error.message });
    return {
      success: false,
      rawText: '',
      data: null,
      error: error.message
    };
  }
}

function parseGeminiResponse(text) {
  let playerName = null;
  let playerId = null;
  let playerLevel = null;

  // Parse NAME
  const nameMatch = text.match(/NAME:\s*(.+)/i);
  if (nameMatch && nameMatch[1].trim() !== 'NOT_FOUND') {
    playerName = nameMatch[1].trim();
  }

  // Parse ID
  const idMatch = text.match(/ID:\s*([0-9A-Fa-f]+)/i);
  if (idMatch && idMatch[1].trim() !== 'NOT_FOUND') {
    playerId = idMatch[1].trim().toUpperCase();
  }

  // Parse LEVEL
  const levelMatch = text.match(/LEVEL:\s*(\d+)/i);
  if (levelMatch && levelMatch[1].trim() !== 'NOT_FOUND') {
    playerLevel = parseInt(levelMatch[1].trim());
  }

  const result = {
    playerId,
    playerName,
    playerLevel,
    confidence: playerId ? 'high' : playerName ? 'high' : 'low'
  };

  logger.info('OCR', 'Parsed Gemini result:', result);
  return result;
}

module.exports = { processImage };
