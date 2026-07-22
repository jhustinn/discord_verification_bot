// ─── Discord API Routes ───────────────────────────────────────────────────────
const express = require('express');
const logger = require('../utils/logger');

function createDiscordRouter(client) {
  const router = express.Router();

  // Middleware: Simple API key auth
  const API_KEY = process.env.API_SECRET_KEY || 'aries-admin-2024';

  function authenticate(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (apiKey !== API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  }

  router.use(authenticate);

  // ─── Guild Info ─────────────────────────────────────────────────────────
  router.get('/guild', async (req, res) => {
    try {
      const guildId = req.query.guild_id || process.env.GUILD_ID;
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      res.json({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL(),
        memberCount: guild.memberCount,
        owner: guild.ownerId,
        createdAt: guild.createdAt
      });
    } catch (error) {
      logger.error('API', 'Get guild failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Members ────────────────────────────────────────────────────────────
  router.get('/members', async (req, res) => {
    try {
      const guildId = req.query.guild_id || process.env.GUILD_ID;
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const members = await guild.members.fetch({ limit: 100 });
      const memberList = members.map(member => ({
        id: member.id,
        username: member.user.username,
        displayName: member.displayName,
        avatar: member.user.displayAvatarURL(),
        joinedAt: member.joinedAt,
        roles: member.roles.cache.map(role => ({
          id: role.id,
          name: role.name,
          color: role.hexColor
        })),
        isBot: member.user.bot
      }));

      res.json({
        total: memberList.length,
        members: memberList
      });
    } catch (error) {
      logger.error('API', 'Get members failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Get Single Member ──────────────────────────────────────────────────
  router.get('/members/:userId', async (req, res) => {
    try {
      const guildId = req.query.guild_id || process.env.GUILD_ID;
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const member = await guild.members.fetch(req.params.userId);

      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      res.json({
        id: member.id,
        username: member.user.username,
        displayName: member.displayName,
        avatar: member.user.displayAvatarURL(),
        joinedAt: member.joinedAt,
        roles: member.roles.cache.map(role => ({
          id: role.id,
          name: role.name,
          color: role.hexColor
        })),
        isBot: member.user.bot,
        permissions: member.permissions.toArray()
      });
    } catch (error) {
      logger.error('API', 'Get member failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Assign Role to Member ──────────────────────────────────────────────
  router.post('/members/:userId/roles', async (req, res) => {
    try {
      const { roleId } = req.body;
      const guildId = req.query.guild_id || process.env.GUILD_ID;
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const member = await guild.members.fetch(req.params.userId);
      const role = guild.roles.cache.get(roleId);

      if (!member || !role) {
        return res.status(404).json({ error: 'Member or role not found' });
      }

      await member.roles.add(role);

      logger.info('API', 'Role assigned', { userId: req.params.userId, roleId });
      res.json({ success: true, message: `Role ${role.name} assigned to ${member.displayName}` });
    } catch (error) {
      logger.error('API', 'Assign role failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Remove Role from Member ────────────────────────────────────────────
  router.delete('/members/:userId/roles/:roleId', async (req, res) => {
    try {
      const guildId = req.query.guild_id || process.env.GUILD_ID;
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const member = await guild.members.fetch(req.params.userId);
      const role = guild.roles.cache.get(req.params.roleId);

      if (!member || !role) {
        return res.status(404).json({ error: 'Member or role not found' });
      }

      await member.roles.remove(role);

      logger.info('API', 'Role removed', { userId: req.params.userId, roleId: req.params.roleId });
      res.json({ success: true, message: `Role ${role.name} removed from ${member.displayName}` });
    } catch (error) {
      logger.error('API', 'Remove role failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Kick Member ────────────────────────────────────────────────────────
  router.post('/members/:userId/kick', async (req, res) => {
    try {
      const { reason } = req.body;
      const guildId = req.query.guild_id || process.env.GUILD_ID;
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const member = await guild.members.fetch(req.params.userId);

      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      await member.kick(reason || 'Kicked by admin');

      logger.info('API', 'Member kicked', { userId: req.params.userId, reason });
      res.json({ success: true, message: `${member.displayName} has been kicked` });
    } catch (error) {
      logger.error('API', 'Kick failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Ban Member ─────────────────────────────────────────────────────────
  router.post('/members/:userId/ban', async (req, res) => {
    try {
      const { reason } = req.body;
      const guildId = req.query.guild_id || process.env.GUILD_ID;
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      await guild.members.ban(req.params.userId, {
        reason: reason || 'Banned by admin'
      });

      logger.info('API', 'Member banned', { userId: req.params.userId, reason });
      res.json({ success: true, message: 'User has been banned' });
    } catch (error) {
      logger.error('API', 'Ban failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Unban Member ───────────────────────────────────────────────────────
  router.post('/members/:userId/unban', async (req, res) => {
    try {
      const guildId = req.query.guild_id || process.env.GUILD_ID;
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      await guild.members.unban(req.params.userId);

      logger.info('API', 'Member unbanned', { userId: req.params.userId });
      res.json({ success: true, message: 'User has been unbanned' });
    } catch (error) {
      logger.error('API', 'Unban failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Roles ──────────────────────────────────────────────────────────────
  router.get('/roles', async (req, res) => {
    try {
      const guildId = req.query.guild_id || process.env.GUILD_ID;
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const roles = guild.roles.cache.map(role => ({
        id: role.id,
        name: role.name,
        color: role.hexColor,
        position: role.position,
        memberCount: role.members.size,
        permissions: role.permissions.toArray()
      }));

      res.json({
        total: roles.length,
        roles: roles.sort((a, b) => b.position - a.position)
      });
    } catch (error) {
      logger.error('API', 'Get roles failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Channels ───────────────────────────────────────────────────────────
  router.get('/channels', async (req, res) => {
    try {
      const guildId = req.query.guild_id || process.env.GUILD_ID;
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const channels = guild.channels.cache.map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        parent: channel.parent?.name || null,
        position: channel.position
      }));

      res.json({
        total: channels.length,
        channels: channels
      });
    } catch (error) {
      logger.error('API', 'Get channels failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Server Stats ───────────────────────────────────────────────────────
  router.get('/stats', async (req, res) => {
    try {
      const guildId = req.query.guild_id || process.env.GUILD_ID;
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const members = await guild.members.fetch();
      const onlineMembers = members.filter(m => m.presence?.status !== 'offline');
      const bots = members.filter(m => m.user.bot);
      const humans = members.filter(m => !m.user.bot);

      res.json({
        guild: {
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL(),
          createdAt: guild.createdAt
        },
        members: {
          total: members.size,
          online: onlineMembers.size,
          humans: humans.size,
          bots: bots.size
        },
        channels: {
          total: guild.channels.cache.size,
          text: guild.channels.cache.filter(c => c.type === 0).size,
          voice: guild.channels.cache.filter(c => c.type === 2).size,
          categories: guild.channels.cache.filter(c => c.type === 4).size
        },
        roles: guild.roles.cache.size
      });
    } catch (error) {
      logger.error('API', 'Get stats failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = { createDiscordRouter };
