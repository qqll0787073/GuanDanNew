# Supabase Project Structure

This directory is reserved for Supabase schema migrations, seed data, and project documentation. It does not apply changes to any existing database by itself.

## Directory Layout

- `migrations/`: SQL migration files managed in chronological order.
- `seed.sql`: Optional local development seed script.
- `README.md`: Notes for the Supabase schema used by the app.

## Tables

### profiles

Stores application user profile data associated with an authenticated Supabase user. Expected profile fields include display name, full name, email, phone, role, approval status, preferred language, and timestamps.

### rooms

Stores GuanDan room metadata such as room names, max player count, current player count, room status, and voice or video availability. Rooms are the lobby-level containers where players gather before or during games.

### room_players

Join table that tracks which profiles are seated in which rooms. This table should represent room membership, seat assignment if needed, and join or leave timing.

### games

Stores game sessions created from rooms. A game should reference its room, track lifecycle status, participating players or teams, current level state, and timestamps for creation, start, and completion.

### teams

Stores team assignments within a game. GuanDan games use two teams, commonly represented as Team A and Team B, with players paired across the table.

### play_history

Stores per-game play events and historical actions. This can include turns, card plays, pass events, round outcomes, rank order, and other data needed to reconstruct gameplay.

### scores

Stores score records for completed rounds or games. Expected fields include game reference, room name, team names, score changes, final levels, winning team, scoring mode, notes, and recorded date.

## Notes

- Keep database schema changes in `migrations/`.
- Keep local seed data in `seed.sql`.
- Do not edit production data directly from this folder.
