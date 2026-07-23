// ─── Message Handlers ─────────────────────────────────────────────────────────
const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const ocrGemini = require('../services/ocr-gemini');
const ocrSpace = require('../services/ocr');
const database = require('../services/database');
const storage = require('../services/storage');
const rateLimiter = require('../utils/rateLimiter');
const validator = require('../utils/validator');
const sanitizer = require('../utils/sanitizer');
const logger = require('../utils/logger');

// Choose OCR service based on available credentials
const useGemini = !!process.env.GEMINI_API_KEY;
const ocrService = useGemini ? ocrGemini : ocrSpace;

logger.info('OCR', `Using ${useGemini ? 'Gemini Vision' : 'OCR.space'} for text extraction`);

async function processVerification(message) {
  const user = message.author;

  // Check rate limit
  const rateLimitCheck = rateLimiter.check(user.id);
  if (!rateLimitCheck.allowed) {
    const rateLimitEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Rate Limited')
      .setDescription(rateLimitCheck.message)
      .setTimestamp();
    await message.reply({ embeds: [rateLimitEmbed] });
    return;
  }

  // Check for existing pending ticket
  const existingTicket = await database.getPendingTicket(user.id);
  if (existingTicket) {
    const duplicateEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Duplicate Submission')
      .setDescription('You already have a pending verification ticket. Please wait for it to be processed.')
      .setTimestamp();
    await message.reply({ embeds: [duplicateEmbed] });
    return;
  }

  // Validate attachment
  if (message.attachments.size ===0) {
    const promptEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Screenshot Required')
      .setDescription('Please attach a verification screenshot along with your in-game name.')
      .setTimestamp();
    await message.reply({ embeds: [promptEmbed] });
    return;
  }

  const attachment = message.attachments.first();

  // Validate file
  const fileValidation = validator.validateFile(attachment);
  if (!fileValidation.valid) {
    const errorEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Invalid File')
      .setDescription(fileValidation.errors.join('\n'))
      .setTimestamp();
    await message.reply({ embeds: [errorEmbed] });
    return;
  }

  // Update rate limit
  rateLimiter.update(user.id);

  // Send processing indicator
  const processingEmbed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('Processing...')
    .setDescription('Your verification is being processed. Please wait.')
    .setTimestamp();
  const processingMsg = await message.reply({ embeds: [processingEmbed] });

  try {
    //1. Download file
    const axios = require('axios');
    const imageResponse = await axios.get(attachment.url, { responseType: 'arraybuffer' });
    const fileExtension = attachment.name.split('.').pop();
    const targetPath = `${user.id}-${Date.now()}.${fileExtension}`;
    const imageBuffer = Buffer.from(imageResponse.data);

    //2. Process OCR
    logger.info('Verification', 'Processing OCR...');
    const ocrResult = await ocrService.processImage(imageBuffer);

    //3. Upload to storage
    await storage.uploadFile(imageBuffer, targetPath, attachment.contentType);
    const publicURL = storage.getPublicUrl(targetPath);

    //4. Upsert user
    await database.upsertUser(user.id, user.tag);

    //5. Insert ticket
    const inGameName = sanitizer.sanitizeInput(message.content) || ocrResult.data?.playerName || 'N/A';

    const ticketData = {
      user_id: user.id,
      in_game_name: inGameName,
      permanent_image_url: publicURL,
      extracted_text: ocrResult.rawText || null,
      player_id: ocrResult.data?.playerId || null,
      player_name: sanitizer.sanitizePlayerName(ocrResult.data?.playerName) || null,
      player_level: validator.validatePlayerLevel(ocrResult.data?.playerLevel).valid ? ocrResult.data.playerLevel : null
    };

    await database.insertTicket(ticketData);

    //6. Send success
    let ocrInfo = '';
    if (ocrResult.success && ocrResult.data) {
      ocrInfo = '\n\n**Auto-Extracted Data:**\n';
      ocrInfo += `- Player ID: ${ocrResult.data.playerId || 'Not detected'}\n`;
      ocrInfo += `- Player Name: ${ocrResult.data.playerName || 'Not detected'}\n`;
      ocrInfo += `- Level: ${ocrResult.data.playerLevel || 'Not detected'}\n`;
      ocrInfo += `- Confidence: ${ocrResult.data.confidence}`;
    }

    const successEmbed = new EmbedBuilder()
      .setColor('#3ecf8e')
      .setTitle('Verification Submitted')
      .setDescription(
        'Your verification data has been stored successfully.\n\n' +
        `**In-Game Name:** ${inGameName}\n` +
        `**Screenshot:** [View File](${publicURL})\n` +
        `**Status:** PENDING` +
        ocrInfo
      )
      .setFooter({ text: 'You will be notified when your verification is processed' })
      .setTimestamp();

    await processingMsg.edit({ embeds: [successEmbed] });

    //7. Assign role if configured
    if (config.VERIFIED_ROLE_ID) {
      try {
        const member = await message.guild.members.fetch(user.id);
        await member.roles.add(config.VERIFIED_ROLE_ID);
      } catch (roleErr) {
        logger.warn('Verification', 'Could not assign role', { error: roleErr.message });
      }
    }

    logger.info('Verification', 'Completed successfully', { userId: user.id, playerName: inGameName });

  } catch (err) {
    logger.error('Verification', 'Processing error', { error: err.message });
    const errorEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Verification Failed')
      .setDescription('An error occurred while processing your submission. Please try again or contact an admin.')
      .setTimestamp();
    await processingMsg.edit({ embeds: [errorEmbed] });
  }
}

module.exports = { processVerification };
