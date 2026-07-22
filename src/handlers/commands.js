// ─── Command Handlers ─────────────────────────────────────────────────────────
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const database = require('../services/database');
const logger = require('../utils/logger');

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
    .setFooter({ text: 'Verification System v1.0.0' })
    .setTimestamp();

  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_ticket')
      .setLabel('Open Ticket')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

async function handleVerifyPanel(interaction) {
  const panel = getVerificationPanel();
  await interaction.channel.send(panel);
  await interaction.reply({ content: 'Verification panel posted.', ephemeral: true });
  logger.info('Commands', 'Verification panel posted', { channel: interaction.channel.name });
}

async function handleVerifyClose(interaction, activeTickets) {
  const channel = interaction.channel;

  if (!channel.name.startsWith('open-ticket-')) {
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

  // Rename channel to closed
  const closedName = channel.name.replace('open-ticket-', 'closed-ticket-');
  await channel.setName(closedName);

  await interaction.reply({ content: 'Ticket closed. Channel will be deleted in5 seconds...' });
  setTimeout(() => channel.delete().catch(() => {}),5000);
  logger.info('Commands', 'Ticket closed', { channel: channel.name });
}

async function handleVerifyStats(interaction) {
  const stats = await database.getStats();

  const statsEmbed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('Verification Statistics')
    .addFields(
      { name: 'Total Users', value: `${stats.totalUsers}`, inline: true },
      { name: 'Total Tickets', value: `${stats.totalTickets}`, inline: true },
      { name: 'Pending', value: `${stats.pending}`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [statsEmbed], ephemeral: true });
  logger.info('Commands', 'Stats requested', { requestedBy: interaction.user.tag });
}

module.exports = {
  commands,
  handleVerifyPanel,
  handleVerifyClose,
  handleVerifyStats
};
