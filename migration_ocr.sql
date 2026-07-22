-- Migration: Add OCR columns to verification_tickets table
-- Run this in Supabase SQL Editor

-- Add new columns for OCR extracted data
ALTER TABLE verification_tickets 
ADD COLUMN IF NOT EXISTS player_id VARCHAR,
ADD COLUMN IF NOT EXISTS player_name VARCHAR,
ADD COLUMN IF NOT EXISTS player_level INTEGER,
ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- Add comments for documentation
COMMENT ON COLUMN verification_tickets.player_id IS 'Player ID extracted from screenshot via OCR';
COMMENT ON COLUMN verification_tickets.player_name IS 'Player name extracted from screenshot via OCR';
COMMENT ON COLUMN verification_tickets.player_level IS 'Player level extracted from screenshot via OCR';
COMMENT ON COLUMN verification_tickets.extracted_text IS 'Raw text extracted from screenshot via OCR';
