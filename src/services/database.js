// ─── Database Service ─────────────────────────────────────────────────────────
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

async function upsertUser(userId, username) {
  const { error } = await supabase
    .from('discord_users')
    .upsert({
      user_id: userId,
      username: username
    }, { onConflict: 'user_id' });

  if (error) {
    logger.error('Database', 'Failed to upsert user', { userId, error: error.message });
    throw new Error(`User record failed: ${error.message}`);
  }

  logger.info('Database', 'User upserted successfully', { userId });
}

async function insertTicket(ticketData) {
  const { error } = await supabase
    .from('verification_tickets')
    .insert(ticketData);

  if (error) {
    logger.error('Database', 'Failed to insert ticket', { error: error.message });
    throw new Error(`Ticket insert failed: ${error.message}`);
  }

  logger.info('Database', 'Ticket inserted successfully', { userId: ticketData.user_id });
}

async function getPendingTicket(userId) {
  const { data, error } = await supabase
    .from('verification_tickets')
    .select('ticket_id')
    .eq('user_id', userId)
    .eq('ticket_status', 'PENDING')
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    logger.error('Database', 'Failed to check pending ticket', { userId, error: error.message });
  }

  return data;
}

async function updateTicketStatus(ticketId, status) {
  const { error } = await supabase
    .from('verification_tickets')
    .update({ ticket_status: status })
    .eq('ticket_id', ticketId);

  if (error) {
    logger.error('Database', 'Failed to update ticket status', { ticketId, error: error.message });
    throw new Error(`Status update failed: ${error.message}`);
  }

  logger.info('Database', 'Ticket status updated', { ticketId, status });
}

async function getStats() {
  const [usersResult, ticketsResult, pendingResult] = await Promise.all([
    supabase.from('discord_users').select('*', { count: 'exact', head: true }),
    supabase.from('verification_tickets').select('*', { count: 'exact', head: true }),
    supabase.from('verification_tickets').select('*', { count: 'exact', head: true }).eq('ticket_status', 'PENDING')
  ]);

  return {
    totalUsers: usersResult.count ||0,
    totalTickets: ticketsResult.count ||0,
    pending: pendingResult.count ||0
  };
}

module.exports = {
  upsertUser,
  insertTicket,
  getPendingTicket,
  updateTicketStatus,
  getStats
};
