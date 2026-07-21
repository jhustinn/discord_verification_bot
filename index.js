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

// ─── Supabase Client ──────────────────────────────────────────────────────────
const WebSocket = require('ws');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
  realtime: { WebSocket }
});

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

  // Validate attachment exists
  if (message.attachments.size === 0) {
    const promptEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Screenshot Required')
      .setDescription('Please attach a verification screenshot along with your in-game name.')
      .setTimestamp();
    await message.reply({ embeds: [promptEmbed] });
    return;
  }

  const attachment = message.attachments.first();

  // Validate file type
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  if (!validTypes.includes(attachment.contentType)) {
    const typeEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Invalid File Type')
      .setDescription('Please upload an image file (PNG, JPG, GIF, or WEBP).')
      .setTimestamp();
    await message.reply({ embeds: [typeEmbed] });
    return;
  }

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

    // 2. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('verification-attachments')
      .upload(targetPath, imageResponse.data, {
        contentType: attachment.contentType,
        upsert: true
      });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    // 3. Get public URL
    const { data: urlData } = supabase.storage
      .from('verification-attachments')
      .getPublicUrl(targetPath);

    // 4. Upsert user record
    const { error: userError } = await supabase
      .from('discord_users')
      .upsert({
        user_id: user.id,
        username: user.tag
      }, { onConflict: 'user_id' });

    if (userError) throw new Error(`User record failed: ${userError.message}`);

    // 5. Insert verification ticket
    const inGameName = message.content?.trim() || 'N/A - Omitted Text';

    const { error: ticketError } = await supabase
      .from('verification_tickets')
      .insert({
        user_id: user.id,
        in_game_name: inGameName,
        permanent_image_url: urlData.publicUrl
      });

    if (ticketError) throw new Error(`Ticket insert failed: ${ticketError.message}`);

    // 6. Send success confirmation
    const successEmbed = new EmbedBuilder()
      .setColor('#3ecf8e')
      .setTitle('Verification Submitted')
      .setDescription(
        'Your verification data has been stored successfully.\n\n' +
        `**In-Game Name:** ${inGameName}\n` +
        `**Screenshot:** [View File](${urlData.publicUrl})\n` +
        `**Status:** PENDING\n\n` +
        'A moderator will review your submission shortly.'
      )
      .setFooter({ text: 'You will be notified when your verification is processed' })
      .setTimestamp();

    await processingMsg.edit({ embeds: [successEmbed] });

    // 7. Optionally assign verified role (if configured and auto-approve is desired)
    if (process.env.VERIFIED_ROLE_ID) {
      try {
        const member = await message.guild.members.fetch(user.id);
        await member.roles.add(process.env.VERIFIED_ROLE_ID);
      } catch (roleErr) {
        console.warn('[Role] Could not assign role:', roleErr.message);
      }
    }

    console.log(`[Verification] ${user.tag} submitted successfully`);

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
