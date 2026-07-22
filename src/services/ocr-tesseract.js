// ─── OCR Service with Tesseract.js ────────────────────────────────────────────
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const logger = require('../utils/logger');

async function processImage(imageBuffer) {
  try {
    logger.info('OCR', 'Starting Tesseract.js processing...');

    // Advanced preprocessing for better accuracy
    const processedBuffer = await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .linear(1.5, 0) // Increase contrast
      .sharpen({ sigma: 2 })
      .toBuffer();

    // Run Tesseract OCR with optimized settings
    const { data: { text, confidence } } = await Tesseract.recognize(processedBuffer, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          logger.info('OCR', `Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
      // Preserve special characters and spaces
      preserve_interword_spaces: '1',
      // Allow all characters including Greek
      tessedit_char_whitelist: '',
      // Use LSTM engine for better accuracy
      tessedit_ocr_engine_mode: '1',
      // Treat image as single text block
      tessedit_pageseg_mode: '6'
    });

    logger.info('OCR', 'Text extracted successfully', { 
      length: text.length, 
      confidence,
      text: text.substring(0, 500) 
    });

    const extractedData = parseText(text);

    return {
      success: true,
      rawText: text,
      data: extractedData,
      confidence: confidence
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
      
      // Only take the FIRST word (before space or parenthesis)
      rawName = rawName.split(/\s+/)[0];
      rawName = rawName.split(/\(/)[0];
      rawName = rawName.split(/\[/)[0];
      
      // Remove trailing artifacts but preserve special characters
      rawName = rawName.replace(/[#]\d*$/g, '').trim();
      rawName = rawName.replace(/[\[\]\(\)]+$/g, '').trim();
      
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
