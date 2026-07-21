# Discord Verification Bot

Automated verification & ticketing system for Discord servers with Supabase backend.

## Setup

### 1. Supabase Setup
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** and run `schema.sql`
3. Go to **Storage** and create a bucket named `verification-attachments` (set to public)
4. Go to **Project Settings > API** and copy:
   - `Project URL` (already set in `.env`)
   - `anon` public key OR `service_role` secret key (recommended for full access)

### 2. Discord Bot Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and bot
3. Enable these intents:
   - `SERVER MEMBERS INTENT`
   - `MESSAGE CONTENT INTENT`
4. Copy the bot token

### 3. Configure `.env`
Edit `.env` and fill in:
- `DISCORD_TOKEN` - Your Discord bot token
- `SUPABASE_KEY` - Your Supabase anon key (or service_role key for full access)
- `WELCOME_CHANNEL_ID` - Right-click channel > Copy ID
- `TICKET_CATEGORY_ID` - Right-click category > Copy ID
- `VERIFIED_ROLE_ID` - (Optional) Right-click role > Copy ID

### 4. Run
```bash
npm start
```

### 5. Deploy Commands
In Discord, type `/verify-panel` in your welcome channel to post the verification panel.

## Commands
- `/verify-panel` - Post verification panel (Admin only)
- `/verify-close` - Close current ticket
- `/verify-stats` - View statistics (Admin only)

## Keep-Alive (for free hosting)
The bot includes an Express server on port 8080. Use UptimeRobot to ping `https://your-service.onrender.com/` every 5 minutes to prevent sleep.
