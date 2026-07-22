// ─── Environment Variable Validation ─────────────────────────────────────────
const requiredEnvVars = [
  'DISCORD_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_KEY'
];

const optionalEnvVars = {
  'TICKET_CATEGORY_ID': null,
  'CLOSED_CATEGORY_ID': null,
  'VERIFIED_ROLE_ID': null,
  'PORT':3000,
  'GUILD_ID': null,
  'OCR_API_KEY': 'helloworld'
};

function validateEnv() {
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length >0) {
    console.error('[Config] Missing required environment variables:', missing);
    console.error('[Config] Please set these in your .env file or Replit Secrets');
    return false;
  }

  console.log('[Config] Environment variables validated successfully');
  return true;
}

function getEnv(key, defaultValue = null) {
  return process.env[key] || defaultValue;
}

module.exports = {
  requiredEnvVars,
  optionalEnvVars,
  validateEnv,
  getEnv,
  
  // Discord
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  GUILD_ID: process.env.GUILD_ID,
  
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  
  // Bot Config
  TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID,
  CLOSED_CATEGORY_ID: process.env.CLOSED_CATEGORY_ID,
  VERIFIED_ROLE_ID: process.env.VERIFIED_ROLE_ID,
  PORT: parseInt(process.env.PORT) ||3000,
  
  // OCR
  OCR_API_KEY: process.env.OCR_API_KEY || 'helloworld',

  // API Security
  API_SECRET_KEY: process.env.API_SECRET_KEY || 'aries-admin-2024'
};
