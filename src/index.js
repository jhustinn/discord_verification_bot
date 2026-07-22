// ─── Main Entry Point ─────────────────────────────────────────────────────────
require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const config = require('./config');
const logger = require('./utils/logger');
const commandHandler = require('./handlers/commands');
const interactionHandler = require('./handlers/interactions');
const messageHandler = require('./handlers/messages');

// ─── Validate Environment ─────────────────────────────────────────────────────
config.validateEnv();

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
const activeTickets = new Map();

// ─── Keep-Alive Server ────────────────────────────────────────────────────────
function startKeepAliveServer() {
  const app = express();

  app.get('/', (req, res) => {
    res.json({
      status: 'online',
      bot: client.user?.tag || 'starting',
      uptime: process.uptime(),
      activeTickets: activeTickets.size
    });
  });

  app.listen(config.PORT, () => {
    logger.info('Server', `Listening on port ${config.PORT}`);
  });
}

// ─── Register Commands ────────────────────────────────────────────────────────
async function registerCommands() {
  const { REST, Routes } = require('discord.js');
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

  try {
    logger.info('Commands', 'Registering slash commands...');
    
    if (config.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, config.GUILD_ID), {
        body: commandHandler.commands.map(c => c.toJSON())
      });
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: commandHandler.commands.map(c => c.toJSON())
      });
    }
    
    logger.info('Commands', 'Slash commands registered successfully');
  } catch (error) {
    logger.error('Commands', 'Registration failed', { error: error.message });
  }
}

// ─── Event: Bot Ready ─────────────────────────────────────────────────────────
client.once('ready', async () => {
  logger.info('Bot', `Logged in as ${client.user.tag}`);
  logger.info('Bot', `Serving ${client.guilds.cache.size} guild(s)`);

  await registerCommands();
  startKeepAliveServer();
});

// ─── Event: Button Interactions ───────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId === 'open_ticket') {
      await interaction.deferReply({ ephemeral: true });
      await interactionHandler.handleOpenTicket(interaction, activeTickets, client);
    }
  }

  if (interaction.isChatInputCommand()) {
    switch (interaction.commandName) {
      case 'verify-panel':
        await commandHandler.handleVerifyPanel(interaction);
        break;
      case 'verify-close':
        await commandHandler.handleVerifyClose(interaction, activeTickets);
        break;
      case 'verify-stats':
        await commandHandler.handleVerifyStats(interaction);
        break;
    }
  }
});

// ─── Event: Message Handler ───────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.channel.name?.startsWith('verify-')) return;
  if (message.attachments.size ===0 && !message.content?.trim()) return;

  if (message.attachments.size >0) {
    await messageHandler.processVerification(message);
  }
});

// ─── Event: Member Leave Cleanup ──────────────────────────────────────────────
client.on('guildMemberRemove', async (member) => {
  const channelId = activeTickets.get(member.id);
  if (channelId) {
    const channel = member.guild.channels.cache.get(channelId);
    if (channel) {
      await channel.send('User has left the server. Closing ticket...');
      setTimeout(() => channel.delete().catch(() => {}),3000);
    }
    activeTickets.delete(member.id);
  }
});

// ─── Error Handling ───────────────────────────────────────────────────────────
process.on('unhandledRejection', (error) => {
  logger.error('System', 'Unhandled rejection', { error: error.message });
});

process.on('uncaughtException', (error) => {
  logger.error('System', 'Uncaught exception', { error: error.message });
});

// ─── Login ────────────────────────────────────────────────────────────────────
client.login(config.DISCORD_TOKEN);
