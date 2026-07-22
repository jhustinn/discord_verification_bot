# MW Verification Bot

Discord Automated Verification & Ticketing System for Modern Warships.

## Features

- 🎫 Automated verification ticket creation
- 🔍 OCR extraction (Player ID, Name, Level)
- ☁️ Supabase cloud storage
- 🔒 Rate limiting & security
- 📊 Statistics dashboard

## Project Structure

```
discord-verification-bot/
├── src/
│   ├── config/
│   │   ├── index.js          # Environment configuration
│   │   └── supabase.js       # Supabase client
│   ├── services/
│   │   ├── ocr.js            # OCR processing (OCR.space)
│   │   ├── database.js       # Database operations
│   │   └── storage.js        # File storage operations
│   ├── handlers/
│   │   ├── commands.js       # Slash command handlers
│   │   ├── interactions.js   # Button interaction handlers
│   │   └── messages.js       # Message handlers
│   ├── utils/
│   │   ├── rateLimiter.js    # Rate limiting
│   │   ├── validator.js      # Input validation
│   │   ├── sanitizer.js      # Input sanitization
│   │   └── logger.js         # Logging utility
│   └── index.js              # Main entry point
├── .env.example
├── .gitignore
├── package.json
├── ROADMAP.md
└── README.md
```

## Prerequisites

- Node.js 18+
- Discord Bot Token
- Supabase Account

## Installation

1. Clone repository:
```bash
git clone https://github.com/jhustinn/discord_verification_bot.git
cd discord_verification_bot
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`

5. Run database migration in Supabase SQL Editor:
```sql
CREATE TABLE IF NOT EXISTS discord_users (
    user_id VARCHAR PRIMARY KEY,
    username VARCHAR NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES discord_users(user_id) ON DELETE CASCADE,
    in_game_name VARCHAR NOT NULL,
    permanent_image_url TEXT NOT NULL,
    ticket_status VARCHAR DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    player_id VARCHAR,
    player_name VARCHAR,
    player_level INTEGER,
    extracted_text TEXT
);
```

6. Create Supabase Storage bucket named `verification-attachments` (public)

7. Start bot:
```bash
npm start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_KEY` | Yes | Supabase service role key |
| `TICKET_CATEGORY_ID` | No | Category ID for tickets |
| `VERIFIED_ROLE_ID` | No | Role ID to assign after verification |
| `PORT` | No | Server port (default:3000) |
| `GUILD_ID` | No | Guild ID for instant commands |
| `OCR_API_KEY` | No | OCR.space API key |

## Commands

| Command | Permission | Description |
|---------|------------|-------------|
| `/verify-panel` | Administrator | Post verification panel |
| `/verify-close` | Manage Channels | Close current ticket |
| `/verify-stats` | Administrator | View statistics |

## Security Features

- ✅ Rate limiting (3 attempts/24h)
- ✅ File size validation (max5MB)
- ✅ Duplicate submission prevention
- ✅ Input sanitization
- ✅ Environment variable validation

## Deployment

### Replit
1. Push to GitHub
2. Import in Replit
3. Add Secrets (environment variables)
4. Run `npm start`
5. Setup UptimeRobot for keep-alive

### Vercel (Frontend)
See `discord-verification-frontend` repository.

## Versioning

See [ROADMAP.md](ROADMAP.md) for version history and planned features.

## License

MIT
