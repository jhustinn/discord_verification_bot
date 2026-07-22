require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes
} = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const express = require('express');

// ─── Environment Variable Validation ─────────────────────────────────────────
const requiredEnvVars = [
  'DISCORD_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_KEY'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length >0) {
  console.error('[Startup] Missing required environment variables:', missingEnvVars);
  console.error('[Startup] Please set these in your .env file or Replit Secrets');
}

// ─── Supabase Client ──────────────────────────────────────────────────────────
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ─── Discord Client ───────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ─── Active Ticket Tracking ───────────────────────────────────────────────────
const activeTickets = new Map(); // userId -> channelId

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const verificationAttempts = new Map(); // userId -> { count, lastAttempt }
const RATE_LIMIT = {
  maxAttempts: 3, // Max attempts per window
  windowMs:24 *60*60*1000, //24 hours
  cooldownMs:60*1000 //1 minute between attempts
};

// ─── Security Constants ───────────────────────────────────────────────────────
const SECURITY = {
  maxFileSize:5*1024*1024, //5MB
  allowedTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'],
  maxNameLength:50,
  minNameLength:2
};

// ─── Rate Limit Check Function ────────────────────────────────────────────────
function checkRateLimit(userId) {
  const now = Date.now();
  const userAttempts = verificationAttempts.get(userId);

  if (!userAttempts) {
    return { allowed: true };
  }

  // Check if cooldown period has passed
  if (now - userAttempts.lastAttempt < SECURITY.cooldownMs) {
    const remaining = Math.ceil((SECURITY.cooldownMs - (now - userAttempts.lastAttempt)) /1000);
    return { 
      allowed: false, 
      message: `Please wait ${remaining} seconds before trying again.` 
    };
  }

  // Check if rate limit exceeded
  if (userAttempts.count >= RATE_LIMIT.maxAttempts) {
    const timeLeft = Math.ceil((RATE_LIMIT.windowMs - (now - userAttempts.lastAttempt)) / (60*60*1000));
    return { 
      allowed: false, 
      message: `Rate limit exceeded. Try again in ${timeLeft} hours.` 
    };
  }

  return { allowed: true };
}

// ─── Update Rate Limit ────────────────────────────────────────────────────────
function updateRateLimit(userId) {
  const now = Date.now();
  const userAttempts = verificationAttempts.get(userId);

  if (!userAttempts) {
    verificationAttempts.set(userId, { count:1, lastAttempt: now });
  } else {
    userAttempts.count +=1;
    userAttempts.lastAttempt = now;
  }
}

// ─── Input Sanitization ──────────────────────────────────────────────────────
function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/['"]/g, '') // Remove quotes
    .replace(/[;\\]/g, '') // Remove injection chars
    .trim()
    .substring(0, SECURITY.maxNameLength);
}

// ─── Validate File ────────────────────────────────────────────────────────────
function validateFile(attachment) {
  const errors = [];

  // Check file size
  if (attachment.size > SECURITY.maxFileSize) {
    errors.push(`File too large. Maximum size is ${SECURITY.maxFileSize / (1024*1024)}MB.`);
  }

  // Check file type
  if (!SECURITY.allowedTypes.includes(attachment.contentType)) {
    errors.push('Invalid file type. Allowed: PNG, JPG, GIF, WEBP.');
  }

  return {
    valid: errors.length ===0,
    errors
  };
}

// ─── OCR Processing Function ──────────────────────────────────────────────────
async function processImageOCR(imageBuffer) {
  try {
    console.log('[OCR] Starting OCR.space processing...');

    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');

    // Prepare form data
    const formData = new URLSearchParams();
    formData.append('base64Image', 'data:image/png;base64,' + base64Image);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2');

    // Call OCR.space API
    const response = await axios.post('https://api.ocr.space/parse/image', 
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apikey': 'helloworld' // Free API key for testing
        }
      }
    );

    console.log('[OCR] OCR.space response:', response.data);

    if (response.data.IsErroredOnProcessing) {
      throw new Error(response.data.ErrorMessage || 'OCR processing failed');
    }

    const text = response.data.ParsedResults?.[0]?.ParsedText || '';
    console.log('[OCR] Raw extracted text:', text);

    // Parse extracted text for Modern Warships data
    const extractedData = parseExtractedText(text);

    return {
      success: true,
      rawText: text,
      data: extractedData
    };
  } catch (error) {
    console.error('[OCR] Processing error:', error.message);
    return {
      success: false,
      rawText: '',
      data: null,
      error: error.message
    };
  }
}

// ─── Parse Extracted Text ─────────────────────────────────────────────────────
function parseExtractedText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let playerId = null;
  let playerName = null;
  let playerLevel = null;

  console.log('[OCR] Parsing lines:', lines);

  // Pattern matching for Modern Warships
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Player ID patterns (hex format like 201F540F07A33955)
    const hexIdMatch = line.match(/Player\s*ID\s*([0-9A-Fa-f]{8,16})/i);
    if (hexIdMatch) {
      playerId = hexIdMatch[1];
      console.log('[OCR] Found Player ID (hex):', playerId);
    }

    // Also try decimal ID format
    const decimalIdMatch = line.match(/(?:id|player\s*id)[:\s]*(\d{6,12})/i);
    if (decimalIdMatch && !playerId) {
      playerId = decimalIdMatch[1];
      console.log('[OCR] Found Player ID (decimal):', playerId);
    }

    // Player Name patterns - look for name in brackets like [ARIES] Solo_plyr4xx
    // Handle OCR misreads: [ARIES) Solo_plyr4xx or (ARIES) Solo_plyr4xx
    const bracketNameMatch = line.match(/[\[\(]([^\]\)]+)[\]\)]\s*(.+)/);
    if (bracketNameMatch) {
      const clanTag = bracketNameMatch[1].trim();
      let rawName = bracketNameMatch[2].trim();
      
      // Clean up the name - remove trailing [#], #4, etc.
      rawName = rawName.replace(/\s*\[#\d*\]\s*$/, '').trim();
      // Remove trailing special characters
      rawName = rawName.replace(/\s*[#\[\]\(\)]+\s*$/, '').trim();
      
      // Skip if name is too short or looks like UI element
      if (rawName.length > 3 && 
          !['Back', 'Title', 'Level', 'Showcase', 'Academy'].includes(rawName)) {
        playerName = rawName;
        console.log('[OCR] Found Clan Tag:', clanTag);
        console.log('[OCR] Found Player Name:', playerName);
      }
    }

    // Also try lines that look like player names (contain underscore, mixed case)
    if (!playerName) {
      const playerNameMatch = line.match(/^([A-Za-z][A-Za-z0-9_]{3,20})$/);
      if (playerNameMatch && 
          !line.includes('Level') && 
          !line.includes('LVL') &&
          !line.includes('Player') &&
          !line.includes('Title') &&
          !line.includes('Chief') &&
          !line.includes('Gold') &&
          !line.includes('Silver')) {
        playerName = playerNameMatch[1];
        console.log('[OCR] Found Player Name (pattern):', playerName);
      }
    }

    // Level patterns - look for "39 Level" or "Level 39"
    const levelMatch1 = line.match(/(\d{1,3})\s*Level/i);
    if (levelMatch1) {
      playerLevel = parseInt(levelMatch1[1]);
      console.log('[OCR] Found Level (number Level):', playerLevel);
    }

    const levelMatch2 = line.match(/Level\s*(\d{1,3})/i);
    if (levelMatch2 && !playerLevel) {
      playerLevel = parseInt(levelMatch2[1]);
      console.log('[OCR] Found Level (Level number):', playerLevel);
    }

    // Also try LVL pattern
    const lvlMatch = line.match(/LVL\s*(\d{1,3})/i);
    if (lvlMatch && !playerLevel) {
      playerLevel = parseInt(lvlMatch[1]);
      console.log('[OCR] Found Level (LVL):', playerLevel);
    }
  }

  // Fallback: If no name found, look for lines that look like player names
  if (!playerName) {
    for (const line of lines) {
      // Skip lines that are just numbers, titles, or UI elements
      if (line.length > 3 && 
          !/^\d+$/.test(line) && 
          !line.includes('Level') && 
          !line.includes('LVL') &&
          !line.includes('Player ID') &&
          !line.includes('STATISTICS') &&
          !line.includes('ACHIEVEMENTS') &&
          !line.includes('CLAN') &&
          !line.includes('RANK')) {
        playerName = line;
        console.log('[OCR] Found Player Name (fallback):', playerName);
        break;
      }
    }
  }

  const result = {
    playerId,
    playerName,
    playerLevel,
    linesCount: lines.length,
    confidence: playerId ? 'high' : playerName ? 'medium' : 'low'
  };

  console.log('[OCR] Final parsed result:', result);
  return result;
}

// ─── Keep-Alive Server ────────────────────────────────────────────────────────
function startKeepAliveServer() {
  const app = express();
  const PORT = process.env.PORT || 8080;

  app.get('/', (req, res) => {
    res.json({
      status: 'online',
      bot: client.user?.tag || 'starting',
      uptime: process.uptime(),
      activeTickets: activeTickets.size
    });
  });

  app.listen(PORT, () => {
    console.log(`[KeepAlive] Server listening on port ${PORT}`);
  });
}

// ─── Register Slash Commands ──────────────────────────────────────────────────
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('verify-panel')
      .setDescription('Post the verification panel in this channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
      .setName('verify-close')
      .setDescription('Close and delete the current verification ticket')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder()
      .setName('verify-stats')
      .setDescription('View verification statistics')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('[Commands] Registering slash commands...');
    // Register to specific guild for instant availability
    const guildId = '1230512877606277130';
    // Application ID: 1528949636746706945
    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
      body: commands.map(c => c.toJSON())
    });
    console.log('[Commands] Slash commands registered successfully');
  } catch (error) {
    console.error('[Commands] Registration failed:', error.message);
  }
}

// ─── Verification Panel Embed ─────────────────────────────────────────────────
function getVerificationPanel() {
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('Verification Required')
    .setDescription(
      'To gain access to this server, you must complete the verification process.\n\n' +
      '**Steps:**\n' +
      '1. Click the **Open Ticket** button below\n' +
      '2. A private channel will be created for you\n' +
      '3. Send your **in-game name** and a **verification screenshot**\n' +
      '4. Wait for confirmation\n\n' +
      'Your screenshot will be stored permanently for audit purposes.'
    )
    .setFooter({ text: 'Verification System v1.0' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_ticket')
      .setLabel('Open Ticket')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

// ─── Create Verification Ticket Channel ───────────────────────────────────────
async function createTicketChannel(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;

  // Check if user already has an active ticket
  if (activeTickets.has(user.id)) {
    const existingChannel = guild.channels.cache.get(activeTickets.get(user.id));
    if (existingChannel) {
      return {
        error: true,
        message: `You already have an active ticket: <#${existingChannel.id}>`
      };
    }
    // Clean up stale entry
    activeTickets.delete(user.id);
  }

  const categoryId = process.env.TICKET_CATEGORY_ID;

  try {
    const channel = await guild.channels.create({
      name: `verify-${user.username}`,
      type: ChannelType.GuildText,
      parent: categoryId || undefined,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels
          ]
        }
      ]
    });

    activeTickets.set(user.id, channel.id);

    // Send welcome instructions
    const welcomeEmbed = new EmbedBuilder()
      .setColor('#FEE75C')
      .setTitle('Verification Ticket Created')
      .setDescription(
        `Welcome <@${user.id}>!\n\n` +
        '**Please provide the following in a single message:**\n' +
        '1. Your **in-game name** (as text)\n' +
        '2. A **screenshot** of your game profile/verification\n\n' +
        'Example: `PlayerName123` + attached screenshot\n\n' +
        '*The bot will automatically process your submission.*'
      )
      .setFooter({ text: 'Send your details in ONE message with the screenshot attached' })
      .setTimestamp();

    await channel.send({ embeds: [welcomeEmbed] });

    return { error: false, channel };
  } catch (err) {
    console.error('[Ticket] Channel creation failed:', err.message);
    return { error: true, message: 'Failed to create ticket channel. Please contact an admin.' };
  }
}

// ─── Process Verification Submission ──────────────────────────────────────────
async function processVerification(message) {
  const user = message.author;
  const channel = message.channel;

  // Check rate limit
  const rateLimitCheck = checkRateLimit(user.id);
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
  const { data: existingTicket } = await supabase
    .from('verification_tickets')
    .select('ticket_id')
    .eq('user_id', user.id)
    .eq('ticket_status', 'PENDING')
    .single();

  if (existingTicket) {
    const duplicateEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Duplicate Submission')
      .setDescription('You already have a pending verification ticket. Please wait for it to be processed.')
      .setTimestamp();
    await message.reply({ embeds: [duplicateEmbed] });
    return;
  }

  // Validate attachment exists
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
  const fileValidation = validateFile(attachment);
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
  updateRateLimit(user.id);

  // Send processing indicator
  const processingEmbed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('Processing...')
    .setDescription('Your verification is being processed. Please wait.')
    .setTimestamp();
  const processingMsg = await message.reply({ embeds: [processingEmbed] });

  try {
    // 1. Download file from Discord CDN
    const imageResponse = await axios.get(attachment.url, { responseType: 'arraybuffer' });
    const fileExtension = attachment.name.split('.').pop();
    const targetPath = `${user.id}-${Date.now()}.${fileExtension}`;
    const imageBuffer = Buffer.from(imageResponse.data);

    // 2. Process OCR on image
    console.log('[OCR] Processing image for text extraction...');
    const ocrResult = await processImageOCR(imageBuffer);
    console.log('[OCR] Result:', ocrResult);

    // 3. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('verification-attachments')
      .upload(targetPath, imageBuffer, {
        contentType: attachment.contentType,
        upsert: true
      });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);
    console.log('[Upload] Success:', uploadData);

    // 4. Get public URL (v1 API)
    const { publicURL, error: urlError } = supabase.storage
      .from('verification-attachments')
      .getPublicUrl(targetPath);

    if (urlError) throw new Error(`Get URL failed: ${urlError.message}`);
    console.log('[URL] Public URL:', publicURL);

    if (!publicURL) throw new Error('Public URL is null');

    // 5. Upsert user record
    const { error: userError } = await supabase
      .from('discord_users')
      .upsert({
        user_id: user.id,
        username: user.tag
      }, { onConflict: 'user_id' });

    if (userError) throw new Error(`User record failed: ${userError.message}`);

    // 6. Insert verification ticket with OCR data
    const inGameName = sanitizeInput(message.content) || ocrResult.data?.playerName || 'N/A - Omitted Text';

    // Validate extracted data
    const playerLevel = ocrResult.data?.playerLevel;
    if (playerLevel && (playerLevel <1 || playerLevel >100)) {
      console.warn('[OCR] Invalid level detected:', playerLevel);
    }

    const ticketData = {
      user_id: user.id,
      in_game_name: inGameName,
      permanent_image_url: publicURL,
      extracted_text: ocrResult.rawText || null,
      player_id: ocrResult.data?.playerId || null,
      player_name: sanitizeInput(ocrResult.data?.playerName) || null,
      player_level: (playerLevel >=1 && playerLevel <=100) ? playerLevel : null
    };

    const { error: ticketError } = await supabase
      .from('verification_tickets')
      .insert(ticketData);

    if (ticketError) throw new Error(`Ticket insert failed: ${ticketError.message}`);

    // 7. Send success confirmation with OCR data
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

    // 8. Optionally assign verified role (if configured and auto-approve is desired)
    if (process.env.VERIFIED_ROLE_ID) {
      try {
        const member = await message.guild.members.fetch(user.id);
        await member.roles.add(process.env.VERIFIED_ROLE_ID);
      } catch (roleErr) {
        console.warn('[Role] Could not assign role:', roleErr.message);
      }
    }

    console.log(`[Verification] ${user.tag} submitted successfully with OCR data`);

  } catch (err) {
    console.error('[Verification] Processing error:', err.message);
    const errorEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Verification Failed')
      .setDescription('An error occurred while processing your submission. Please try again or contact an admin.')
      .setTimestamp();
    await processingMsg.edit({ embeds: [errorEmbed] });
  }
}

// ─── Event: Bot Ready ─────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`[Bot] Logged in as ${client.user.tag}`);
  console.log(`[Bot] Serving ${client.guilds.cache.size} guild(s)`);

  await registerCommands();
  startKeepAliveServer();
});

// ─── Event: Button Interactions ───────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'open_ticket') {
    await interaction.deferReply({ ephemeral: true });

    const result = await createTicketChannel(interaction);

    if (result.error) {
      await interaction.editReply({ content: result.message });
    } else {
      await interaction.editReply({
        content: `Ticket created: <#${result.channel.id}>`
      });
    }
  }
});

// ─── Event: Slash Commands ────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'verify-panel') {
    const panel = getVerificationPanel();
    await interaction.channel.send(panel);
    await interaction.reply({ content: 'Verification panel posted.', ephemeral: true });
  }

  if (interaction.commandName === 'verify-close') {
    const channel = interaction.channel;

    if (!channel.name.startsWith('verify-')) {
      await interaction.reply({
        content: 'This command can only be used in verification ticket channels.',
        ephemeral: true
      });
      return;
    }

    // Remove from active tracking
    for (const [userId, channelId] of activeTickets.entries()) {
      if (channelId === channel.id) {
        activeTickets.delete(userId);
        break;
      }
    }

    await interaction.reply({ content: 'Closing ticket in 5 seconds...' });
    setTimeout(() => channel.delete().catch(() => {}), 5000);
  }

  if (interaction.commandName === 'verify-stats') {
    const { count: userCount } = await supabase
      .from('discord_users')
      .select('*', { count: 'exact', head: true });

    const { count: ticketCount } = await supabase
      .from('verification_tickets')
      .select('*', { count: 'exact', head: true });

    const { count: pendingCount } = await supabase
      .from('verification_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('ticket_status', 'PENDING');

    const statsEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('Verification Statistics')
      .addFields(
        { name: 'Total Users', value: `${userCount || 0}`, inline: true },
        { name: 'Total Tickets', value: `${ticketCount || 0}`, inline: true },
        { name: 'Pending', value: `${pendingCount || 0}`, inline: true },
        { name: 'Active Tickets', value: `${activeTickets.size}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [statsEmbed], ephemeral: true });
  }
});

// ─── Event: Message Handler (Verification Processing) ─────────────────────────
client.on('messageCreate', async (message) => {
  // Ignore bots
  if (message.author.bot) return;

  // Check if message is in a verification channel
  if (!message.channel.name?.startsWith('verify-')) return;

  // Check if message has content or attachments
  if (message.attachments.size === 0 && !message.content?.trim()) return;

  // Process verification if attachment present
  if (message.attachments.size > 0) {
    await processVerification(message);
  }
});

// ─── Event: Member Leave Cleanup ──────────────────────────────────────────────
client.on('guildMemberRemove', async (member) => {
  // Close active ticket if user leaves
  const channelId = activeTickets.get(member.id);
  if (channelId) {
    const channel = member.guild.channels.cache.get(channelId);
    if (channel) {
      await channel.send('User has left the server. Closing ticket...');
      setTimeout(() => channel.delete().catch(() => {}), 3000);
    }
    activeTickets.delete(member.id);
  }
});

// ─── Error Handling ───────────────────────────────────────────────────────────
process.on('unhandledRejection', (error) => {
  console.error('[System] Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('[System] Uncaught exception:', error);
});

// ─── Login ────────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
