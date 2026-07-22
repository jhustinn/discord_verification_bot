// ─── Interaction Handlers ─────────────────────────────────────────────────────
const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');

async function handleOpenTicket(interaction, activeTickets, client) {
  const guild = interaction.guild;
  const user = interaction.user;

  // Check if user already has an active ticket
  if (activeTickets.has(user.id)) {
    const existingChannel = guild.channels.cache.get(activeTickets.get(user.id));
    if (existingChannel) {
      await interaction.editReply({ 
        content: `You already have an active ticket: <#${existingChannel.id}>` 
      });
      return;
    }
    activeTickets.delete(user.id);
  }

  const categoryId = config.TICKET_CATEGORY_ID;

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
    await interaction.editReply({ content: `Ticket created: <#${channel.id}>` });

    logger.info('Interactions', 'Ticket created', { userId: user.id, channelId: channel.id });
  } catch (err) {
    logger.error('Interactions', 'Channel creation failed', { error: err.message });
    await interaction.editReply({ content: 'Failed to create ticket channel. Please contact an admin.' });
  }
}

module.exports = { handleOpenTicket };
