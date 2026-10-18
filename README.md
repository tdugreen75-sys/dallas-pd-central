# Dallas PD Central - Discord Bot

A complete roleplay police department bot for Discord.

## Features

- Officer registration with badge numbers
- Clock In / Clock Out + Active officers list
- Arrest Logs, Citation Logs, Incident Reports
- Traffic Stops & Car Accident reports
- Warrant system (Officer → Supervisor → Judge)
- BOLO system
- Automatic Case Numbers (`DPD-2026-XXXX`)
- Evidence attachment system (photos + descriptions)
- Search by case number
- Void / Edit logs (Supervisor+)
- Shift activity reports
- Dedicated log channels for every type

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create a Discord Bot**
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Go to Bot → Reset Token → Copy the token
   - Under OAuth2 → URL Generator → Select `bot` and `applications.commands`
   - Invite the bot to your server

3. **Edit `.env`**
   ```
   TOKEN=your_bot_token_here
   CLIENT_ID=your_bot_client_id
   GUILD_ID=your_server_id
   ```

4. **Edit `config.json`**
   - Create the roles: `Officer`, `Supervisor`, `Judge`, `Command Staff`
   - Create the log channels
   - Paste the Role IDs and Channel IDs into `config.json`

5. **Start the bot**
   ```bash
   node index.js
   ```

## Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `/register` | Register with badge number | Officer+ |
| `/clockin` | Clock in | Officer+ |
| `/clockout` | Clock out | Officer+ |
| `/status` | Your duty status | Everyone |
| `/active` | Who is currently on duty | Everyone |
| `/arrest` | Log an arrest | Officer+ |
| `/citation` | Log a citation | Officer+ |
| `/incident` | Log an incident | Officer+ |
| `/trafficstop` | Log a traffic stop | Officer+ |
| `/accident` | Log a car accident | Officer+ |
| `/warrant` | Request a warrant | Officer+ |
| `/bolo` | Create a BOLO | Officer+ |
| `/bolos` | View active BOLOs | Everyone |
| `/clearbolo` | Clear a BOLO | Supervisor+ |
| `/case` | Search by case number | Everyone |
| `/logs` | View recent logs by type | Everyone |
| `/evidence` | Attach evidence/photo to a case | Officer+ |
| `/removeevidence` | Remove evidence | Supervisor+ |
| `/void` | Void a log | Supervisor+ |
| `/editlog` | Edit a log | Supervisor+ |
| `/shiftreport` | Your activity summary | Officer+ |

## Notes

- This bot is designed for **roleplay** servers only.
- All logs receive automatic case numbers.
- Evidence supports multiple photos per case (run `/evidence` multiple times).
- Warrant flow uses buttons for Supervisor and Judge approval.
