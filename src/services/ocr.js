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
    formData.append('scale', 'true');
    formData.append('isTable', 'true');

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
    logger.info('OCR', 'Text extracted successfully', { length: text.length, text: text.substring(0, 200) });

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
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let playerId = null;
  let playerName = null;
  let playerLevel = null;

  logger.info('OCR', 'Parsing lines:', { count: lines.length });

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Player ID (hex format) - supports uppercase hex
    const hexIdMatch = line.match(/Player\s*ID\s*([0-9A-Fa-f]{8,16})/i);
    if (hexIdMatch) {
      playerId = hexIdMatch[1].toUpperCase();
      logger.info('OCR', 'Found Player ID:', { playerId });
    }

    // Player ID (decimal format)
    if (!playerId) {
      const decimalIdMatch = line.match(/(?:id|player\s*id)[:\s]*(\d{6,12})/i);
      if (decimalIdMatch) {
        playerId = decimalIdMatch[1];
        logger.info('OCR', 'Found Player ID (decimal):', { playerId });
      }
    }

    // Player Name - Multiple patterns for different formats
    
    // Pattern 1: [CLAN] PlayerName - most common
    const bracketNameMatch = line.match(/[\[\(]([^\]\)]*)[\]\)]\s*(.+)/);
    if (bracketNameMatch && !playerName) {
      const clanTag = bracketNameMatch[1].trim();
      let rawName = bracketNameMatch[2].trim();
      
      // Remove trailing artifacts but preserve special characters
      rawName = rawName.replace(/\s*[#]\d*\s*$/, '').trim();
      // Remove trailing brackets/parens that are OCR artifacts
      rawName = rawName.replace(/\s*[\[\]\(\)]+\s*$/, '').trim();
      
      // Skip UI elements
      const skipWords = ['Back', 'Title', 'Level', 'Showcase', 'Academy', 'STATISTICS', 'ACHIEVEMENTS'];
      const skipPatterns = [/^Back$/i, /^Title$/i, /^Level$/i, /^\d+$/];
      
      const shouldSkip = skipWords.includes(rawName) || skipPatterns.some(p => p.test(rawName));
      
      if (rawName.length >= 2 && !shouldSkip) {
        playerName = rawName;
        logger.info('OCR', 'Found Player Name (bracket):', { playerName, clanTag, originalLine: line });
      }
    }

    // Pattern 2: Name after "Title" line (fallback)
    if (!playerName && i > 0) {
      const prevLine = lines[i - 1];
      if (prevLine.match(/Title/i) && !line.match(/^(Back|Level|Showcase|Academy|STATISTICS|ACHIEVEMENTS|CLAN)$/i)) {
        // Simple pattern: any word characters including Unicode
        const nameMatch = line.match(/^(\S+)$/);
        if (nameMatch && nameMatch[1].length >= 2) {
          playerName = nameMatch[1];
          logger.info('OCR', 'Found Player Name (after Title):', { playerName, line });
        }
      }
    }

    // Level patterns - more flexible
    const levelMatch1 = line.match(/(\d{1,3})\s*Level/i);
    const levelMatch2 = line.match(/Level\s*(\d{1,3})/i);
    const levelMatch3 = line.match(/LVL\s*(\d{1,3})/i);
    
    const levelResult = levelMatch1 || levelMatch2 || levelMatch3;
    if (levelResult && !playerLevel) {
      playerLevel = parseInt(levelResult[1]);
      logger.info('OCR', 'Found Level:', { playerLevel });
    }
  }

  // Fallback: Try to find name from lines that look like player names
  if (!playerName) {
    for (const line of lines) {
      // Skip lines that are clearly not player names
      if (line.length < 3 || line.length > 30) continue;
      if (/^\d+$/.test(line)) continue;
      if (/^(Back|Title|Level|Showcase|Academy|STATISTICS|ACHIEVEMENTS|CLAN|NAVAL|COMMANDER|LIEUTENANT|CHIEF|WARRANT|OFFICER|GOLD|PLATINUM|DIAMOND|Received|Points|Current|Best|rank|Season)$/i.test(line)) continue;
      if (/^(Player\s*ID|Achievements|Showcase)/i.test(line)) continue;
      if (/^\d+\/\d+$/.test(line)) continue;
      if (/^\d+\s*\/\s*\d+$/.test(line)) continue;
      
      // Check if line contains letters (including Unicode special chars)
      if (/[a-zA-Z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0500-\u052F\u1F00-\u1FFF\u2000-\u206F\u2070-\u209F\u20A0-\u20CF\u2100-\u214F\u2190-\u21FF\u2200-\u22FF\u2300-\u23FF\u2460-\u24FF\u2500-\u257F\u2580-\u259F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF]/.test(line)) {
        playerName = line;
        logger.info('OCR', 'Found Player Name (fallback):', { playerName });
        break;
      }
    }
  }

  const result = {
    playerId,
    playerName,
    playerLevel,
    confidence: playerId ? 'high' : playerName ? 'medium' : 'low'
  };

  logger.info('OCR', 'Final parsed result:', result);
  return result;
}

module.exports = { processImage, parseText };

