// ─── OCR Service ──────────────────────────────────────────────────────────────
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

async function processImage(imageBuffer) {
  try {
    logger.info('OCR', 'Starting OCR.space processing...');

    const base64Image = imageBuffer.toString('base64');

    const formData = new URLSearchParams();
    formData.append('base64Image', 'data:image/png;base64,' + base64Image);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2');

    const response = await axios.post('https://api.ocr.space/parse/image', 
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apikey': config.OCR_API_KEY
        }
      }
    );

    if (response.data.IsErroredOnProcessing) {
      throw new Error(response.data.ErrorMessage || 'OCR processing failed');
    }

    const text = response.data.ParsedResults?.[0]?.ParsedText || '';
    logger.info('OCR', 'Text extracted successfully', { length: text.length });

    const extractedData = parseText(text);

    return {
      success: true,
      rawText: text,
      data: extractedData
    };
  } catch (error) {
    logger.error('OCR', 'Processing error', { error: error.message });
    return {
      success: false,
      rawText: '',
      data: null,
      error: error.message
    };
  }
}

function parseText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length >0);

  let playerId = null;
  let playerName = null;
  let playerLevel = null;

  for (let i =0; i < lines.length; i++) {
    const line = lines[i];

    // Player ID (hex format)
    const hexIdMatch = line.match(/Player\s*ID\s*([0-9A-Fa-f]{8,16})/i);
    if (hexIdMatch) {
      playerId = hexIdMatch[1];
    }

    // Player ID (decimal format)
    if (!playerId) {
      const decimalIdMatch = line.match(/(?:id|player\s*id)[:\s]*(\d{6,12})/i);
      if (decimalIdMatch) {
        playerId = decimalIdMatch[1];
      }
    }

    // Player Name (bracket format)
    const bracketNameMatch = line.match(/[\[\(]([^\]\)]+)[\]\)]\s*(.+)/);
    if (bracketNameMatch) {
      let rawName = bracketNameMatch[2].trim();
      rawName = rawName.replace(/\s*\[#\d*\]\s*$/, '').trim();
      rawName = rawName.replace(/\s*[#\[\]\(\)]+\s*$/, '').trim();
      
      const skipWords = ['Back', 'Title', 'Level', 'Showcase', 'Academy'];
      if (rawName.length >3 && !skipWords.includes(rawName)) {
        playerName = rawName;
      }
    }

    // Level patterns
    const levelMatch = line.match(/(\d{1,3})\s*Level/i) || line.match(/Level\s*(\d{1,3})/i);
    if (levelMatch) {
      playerLevel = parseInt(levelMatch[1]);
    }
  }

  return {
    playerId,
    playerName,
    playerLevel,
    confidence: playerId ? 'high' : playerName ? 'medium' : 'low'
  };
}

module.exports = { processImage, parseText };
