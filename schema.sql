-- Discord Verification Bot Schema
-- Run this in Supabase SQL Editor

-- Core membership tracking directory
CREATE TABLE IF NOT EXISTS discord_users (
    user_id VARCHAR PRIMARY KEY,
    username VARCHAR NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verification transaction ledger
CREATE TABLE IF NOT EXISTS verification_tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES discord_users(user_id) ON DELETE CASCADE,
    in_game_name VARCHAR NOT NULL,
    permanent_image_url TEXT NOT NULL,
    ticket_status VARCHAR DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE discord_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_tickets ENABLE ROW LEVEL SECURITY;

-- Policies for service role access
CREATE POLICY "Service role can manage discord_users" ON discord_users
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage verification_tickets" ON verification_tickets
    FOR ALL USING (true) WITH CHECK (true);
