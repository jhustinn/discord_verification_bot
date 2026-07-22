# MW Verification Bot - Complete Setup Guide

Panduan lengkap dari awal sampai akhir untuk setup Discord Verification Bot.

---

## Daftar Isi

1. [Persiapan](#1-persiapan)
2. [Setup Discord Bot](#2-setup-discord-bot)
3. [Setup Supabase](#3-setup-supabase)
4. [Setup Replit](#4-setup-replit)
5. [Konfigurasi Bot](#5-konfigurasi-bot)
6. [Menjalankan Bot](#6-menjalankan-bot)
7. [Setup UptimeRobot](#7-setup-uptimerobot)
8. [Testing](#8-testing)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Persiapan

### Yang Dibutuhkan:
- Akun Discord
- Akun GitHub
- Akun Supabase (gratis)
- Akun Replit (gratis)
- Akun UptimeRobot (gratis)

### Tools yang Dibutuhkan:
- Browser web
- Git (opsional, untuk local development)

---

## 2. Setup Discord Bot

### 2.1 Buat Aplikasi Discord

1. Buka [Discord Developer Portal](https://discord.com/developers/applications)
2. Klik **New Application**
3. Beri nama: `MW Verification Bot`
4. Klik **Create**

### 2.2 Buat Bot

1. Klik menu **Bot** di sidebar kiri
2. Klik **Reset Token** > **Copy Token**
3. **Simpan token ini** - Anda akan membutuhkannya nanti
4. Aktifkan **Privileged Gateway Intents**:
   - ✅ **SERVER MEMBERS INTENT**
   - ✅ **MESSAGE CONTENT INTENT**
5. Klik **Save Changes**

### 2.3 Matikan Public Client

1. Klik menu **OAuth2** di sidebar kiri
2. Scroll ke bawah ke **Client information**
3. Matikan toggle **Public Client** (OFF)
4. Klik **Save Changes**

### 2.4 Generate Invite URL

1. Klik menu **OAuth2** > **URL Generator**
2. Scopes: centang:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Bot Permissions: centang:
   - ✅ `Administrator`
4. Copy URL yang muncul di bawah
5. Buka URL di browser
6. Pilih server Discord Anda
7. Klik **Authorize**

### 2.5 Dapatkan ID yang Dibutuhkan

Aktifkan **Developer Mode** di Discord:
- Discord Settings > Advanced > Developer Mode: ON

Klik kanan untuk copy ID:
- **WELCOME_CHANNEL_ID**: Channel tempat panel verifikasi diposting
- **TICKET_CATEGORY_ID**: Category tempat ticket dibuat
- **CLOSED_CATEGORY_ID**: Category tempat ticket yang sudah ditutup dipindahkan
- **VERIFIED_ROLE_ID**: Role yang diberikan setelah verifikasi

---

## 3. Setup Supabase

### 3.1 Buat Akun Supabase

1. Buka [supabase.com](https://supabase.com)
2. Klik **Start your project**
3. Login dengan GitHub
4. Buat organization (jika diminta)

### 3.2 Buat Project

1. Klik **New Project**
2. Isi:
   - **Organization**: Pilih atau buat baru
   - **Project name**: `mw-verification`
   - **Database password**: Buat password yang kuat (simpan!)
   - **Region**: Pilih yang terdekat
3. Klik **Create new project**
4. Tunggu proses setup selesai (~2 menit)

### 3.3 Dapatkan API Keys

1. Klik **Project Settings** (icon gear di sidebar)
2. Klik **API**
3. Copy:
   - **Project URL**: `https://xxxxxxxx.supabase.co`
   - **service_role secret**: Klik **Reveal** > Copy

### 3.4 Buat Database Tables

1. Klik **SQL Editor** di sidebar
2. Klik **New query**
3. Paste kode berikut:

```sql
-- Buat tabel discord_users
CREATE TABLE IF NOT EXISTS discord_users (
    user_id VARCHAR PRIMARY KEY,
    username VARCHAR NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buat tabel verification_tickets
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

-- Tambah komentar
COMMENT ON COLUMN verification_tickets.player_id IS 'Player ID extracted from screenshot via OCR';
COMMENT ON COLUMN verification_tickets.player_name IS 'Player name extracted from screenshot via OCR';
COMMENT ON COLUMN verification_tickets.player_level IS 'Player level extracted from screenshot via OCR';
COMMENT ON COLUMN verification_tickets.extracted_text IS 'Raw text extracted from screenshot via OCR';
```

4. Klik **Run** (atau tekan Ctrl+Enter)

### 3.5 Buat Storage Bucket

1. Klik **Storage** di sidebar
2. Klik **New bucket**
3. Isi:
   - **Name**: `verification-attachments`
   - **Public bucket**: ✅ Aktifkan
4. Klik **Create bucket**

---

## 4. Setup Replit

### 4.1 Buat Akun Replit

1. Buka [replit.com](https://replit.com)
2. Login dengan GitHub

### 4.2 Import Repository

1. Klik **Create Repl**
2. Pilih **Import from GitHub**
3. Masukkan URL: `https://github.com/jhustinn/discord_verification_bot`
4. Klik **Import**

### 4.3 Tambah Environment Variables (Secrets)

1. Klik tab **Secrets** (icon gembok 🔑) di sidebar
2. Tambahkan satu per satu:

| Key | Value |
|-----|-------|
| `DISCORD_TOKEN` | Token bot Discord Anda |
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_KEY` | Service role key Supabase |
| `TICKET_CATEGORY_ID` | ID category ticket |
| `CLOSED_CATEGORY_ID` | ID category closed ticket |
| `VERIFIED_ROLE_ID` | ID role verified |
| `PORT` | `3000` |

---

## 5. Konfigurasi Bot

### 5.1 Edit File Konfigurasi (Opsional)

Jika Anda ingin mengubah pengaturan default, edit file `src/config/index.js`:

```javascript
// Rate limiting
const LIMITS = {
  maxAttempts:3,    // Max percobaan per window
  windowMs:24*60*60*1000, //24 jam
  cooldownMs:60*1000 //1 menit antar percobaan
};

// File validation
const SECURITY = {
  maxFileSize:5*1024*1024, //5MB
  allowedTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'],
  maxNameLength:50,
  minNameLength:2
};
```

---

## 6. Menjalankan Bot

### 6.1 Install Dependencies

Di Replit Shell:
```bash
npm install
```

### 6.2 Jalankan Bot

```bash
npm start
```

Anda akan melihat:
```
[INFO] [Config] Environment variables validated successfully
[INFO] [Bot] Logged in as MW Verification Bot#1234
[INFO] [Bot] Serving1 guild(s)
[INFO] [Commands] Slash commands registered successfully
[INFO] [Server] Listening on port3000
```

### 6.3 Post Verification Panel

Di Discord:
1. Buka channel welcome
2. Ketik: `/verify-panel`
3. Kirim

Panel verifikasi akan muncul dengan tombol **Open Ticket**.

---

## 7. Setup UptimeRobot

### 7.1 Buat Akun UptimeRobot

1. Buka [uptimerobot.com](https://uptimerobot.com)
2. Daftar/Login

### 7.2 Dapatkan URL Bot

Di Replit:
1. Jalankan bot: `npm start`
2. Di Shell, ketik:
```bash
echo $REPLIT_DEV_DOMAIN
```
3. URL bot: `https://[hasil-echo]`

### 7.3 Buat Monitor

1. Klik **Add New Monitor**
2. Isi:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: `MW Verification Bot`
   - **URL**: `https://[REPLIT_DEV_DOMAIN]`
   - **Monitoring Interval**: 5 minutes
3. Klik **Create Monitor**

---

## 8. Testing

### 8.1 Test Verifikasi

1. Buka Discord
2. Klik tombol **Open Ticket** di panel verifikasi
3. Channel `open-ticket-{username}` akan dibuat
4. Kirim screenshot Modern Warships
5. Bot akan:
   - Mengextract data via OCR
   - Mengupload screenshot ke Supabase
   - Menyimpan data ke database
   - Mengassign role verified (jika dikonfigurasi)

### 8.2 Test Close Ticket

1. Di channel ticket, ketik: `/verify-close`
2. Channel akan:
   - Rename ke `closed-ticket-{username}`
   - Dipindah ke category "Closed Tickets"
   - User tidak bisa kirim pesan lagi

### 8.3 Test Stats

1. Ketik: `/verify-stats`
2. Statistik akan ditampilkan

---

## 9. Troubleshooting

### Bot tidak merespons

**Cek:**
- Apakah bot online di Discord? (lihat status)
- Apakah bot sudah diundang ke server?
- Apakah intents sudah aktif?

**Solusi:**
```bash
# Restart bot
npm start
```

### Error "Missing Access"

**Penyebab:** Bot tidak punya permission

**Solusi:**
1. Server Settings > Roles
2. Cari role bot
3. Aktifkan **Administrator**
4. Save

### Error "Invalid supabaseUrl"

**Penyebab:** Environment variable tidak terbaca

**Solusi:**
1. Cek Secrets di Replit
2. Pastikan `SUPABASE_URL` benar
3. Tidak ada spasi di awal/akhir

### OCR tidak berfungsi

**Cek:**
- Console Replit untuk error
- Apakah gambar terupload?

**Solusi:**
- Pastikan gambar jelas dan tidak blur
- Coba dengan screenshot berbeda

### Bot mati setelah beberapa menit

**Penyebab:** UptimeRobot tidak aktif

**Solusi:**
1. Cek UptimeRobot dashboard
2. Pastikan monitor status "Up"
3. Pastikan URL benar

---

## 10. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_TOKEN` | Yes | - | Token bot Discord |
| `SUPABASE_URL` | Yes | - | URL project Supabase |
| `SUPABASE_KEY` | Yes | - | Service role key Supabase |
| `TICKET_CATEGORY_ID` | No | - | Category ID untuk ticket |
| `CLOSED_CATEGORY_ID` | No | - | Category ID untuk closed ticket |
| `VERIFIED_ROLE_ID` | No | - | Role ID untuk verified |
| `PORT` | No |3000 | Port server |
| `GUILD_ID` | No | - | Guild ID untuk instant commands |
| `OCR_API_KEY` | No | helloworld | API key OCR.space |

---

## 11. Commands Reference

| Command | Permission | Description |
|---------|------------|-------------|
| `/verify-panel` | Administrator | Post panel verifikasi |
| `/verify-close` | Manage Channels | Tutup ticket dan pindah ke closed |
| `/verify-stats` | Administrator | Lihat statistik verifikasi |

---

## 12. Security Features

- ✅ Rate limiting (3 percobaan/24 jam)
- ✅ File size validation (max5MB)
- ✅ Duplicate submission prevention
- ✅ Input sanitization
- ✅ Environment variable validation
- ✅ Channel permission management

---

## Support

Jika ada masalah:
1. Cek console Replit untuk error
2. Cek UptimeRobot untuk status bot
3. Pastikan semua environment variable benar

---

**Version:**1.0.0
**Last Updated:** July2026
