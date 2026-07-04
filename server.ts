import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const DB_FILE = path.join(process.cwd(), "server_db.json");

// Helper to read DB
function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: [], rooms: [], scores: [] };
  }
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(data);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
      scores: Array.isArray(parsed.scores) ? parsed.scores : [],
    };
  } catch (err) {
    console.error("Failed to read server DB file", err);
    return { users: [], rooms: [], scores: [] };
  }
}

// Helper to write DB
function writeDb(data: any) {
  try {
    const current = readDb();
    const updated = { ...current, ...data };
    fs.writeFileSync(DB_FILE, JSON.stringify(updated, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write server DB file", err);
  }
}

// Seed 120 deterministic users if they do not exist
function seedBuiltinUsers() {
  const db = readDb();
  const currentUsers = db.users || [];
  
  // Check if we already have the builtin users
  const hasBuiltins = currentUsers.some((u: any) => u && u.id && u.id.startsWith("user-builtin-"));
  if (hasBuiltins) {
    return;
  }

  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const users: any[] = [];
  let seed = 123456789;
  function random() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }
  
  const emailsSet = new Set<string>();
  while (emailsSet.size < 120) {
    let localPart = "";
    for (let i = 0; i < 4; i++) {
      const idx = Math.floor(random() * chars.length);
      localPart += chars[idx];
    }
    const email = `${localPart}@gamil.com`;
    if (!emailsSet.has(email)) {
      emailsSet.add(email);
    }
  }

  const sortedEmails = Array.from(emailsSet).sort();
  sortedEmails.forEach((email, index) => {
    const localPart = email.split('@')[0];
    const password = `${localPart}333`;
    users.push({
      id: `user-builtin-${index + 1}`,
      fullName: `Builtin Player ${index + 1}`,
      displayName: `玩家_${localPart.toUpperCase()}`,
      email: email,
      password: password,
      role: "player",
      status: "Approved",
      preferredLanguage: "zh",
      createdAt: "2026-07-03T19:50:00.000Z"
    });
  });

  const updatedUsers = [...currentUsers, ...users];
  writeDb({ users: updatedUsers });
  console.log(`Successfully seeded ${users.length} builtin players into server_db.json.`);
}

async function startServer() {
  // Ensure builtin users are seeded before start
  seedBuiltinUsers();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/state", (req, res) => {
    const db = readDb();
    res.json(db);
  });

  app.post("/api/register", (req, res) => {
    const { user } = req.body;
    if (!user || !user.id || !user.email) {
      return res.status(400).json({ error: "Invalid user data" });
    }
    const db = readDb();
    const currentUsers = db.users || [];
    
    const emailNorm = user.email.trim().toLowerCase();
    const exists = currentUsers.some((u: any) => u && u.email && u.email.toLowerCase() === emailNorm);
    if (exists) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const newUser = { ...user, email: emailNorm };
    currentUsers.push(newUser);
    writeDb({ users: currentUsers });
    res.json({ success: true, user: newUser });
  });

  app.post("/api/users", (req, res) => {
    const { users } = req.body;
    if (users && Array.isArray(users)) {
      const db = readDb();
      const currentUsers = db.users || [];
      const userMap = new Map();

      // Load existing users from server database
      currentUsers.forEach((u: any) => {
        if (u && u.id) userMap.set(u.id, u);
      });

      // Merge with incoming users
      users.forEach((u: any) => {
        if (u && u.id) {
          const existing = userMap.get(u.id);
          if (!existing) {
            userMap.set(u.id, u);
          } else {
            // Keep critical server state like role: admin and processed status (Approved, Suspended, Rejected)
            // unless the incoming status has been upgraded.
            const merged = { ...existing, ...u };
            if (existing.role === 'admin') {
              merged.role = 'admin';
            }
            // Admin actions like Suspend, Reject, Approve are authoritative
            if (existing.status === 'Suspended' && u.status !== 'Suspended') {
              merged.status = 'Suspended';
            } else if (existing.status === 'Rejected' && u.status !== 'Rejected') {
              merged.status = 'Rejected';
            } else if (existing.status === 'Approved' && u.status === 'Pending') {
              merged.status = 'Approved';
            }
            userMap.set(u.id, merged);
          }
        }
      });

      const mergedUsers = Array.from(userMap.values());
      writeDb({ users: mergedUsers });
      res.json({ success: true, users: mergedUsers });
    } else {
      res.status(400).json({ error: "Missing users" });
    }
  });

  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }
    const db = readDb();
    const matched = (db.users || []).find((u: any) => u && u.email && u.email.toLowerCase() === email.toLowerCase());
    if (matched) {
      if (matched.password && matched.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      return res.json({ success: true, user: matched });
    }
    return res.status(404).json({ error: "User not found" });
  });

  app.post("/api/users/update-password", (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const db = readDb();
    const currentUsers = db.users || [];
    const matchedIdx = currentUsers.findIndex((u: any) => u && u.id === userId);
    if (matchedIdx !== -1) {
      const user = currentUsers[matchedIdx];
      if (user.password && user.password !== oldPassword) {
        return res.status(400).json({ error: "Incorrect old password" });
      }
      user.password = newPassword;
      currentUsers[matchedIdx] = user;
      writeDb({ users: currentUsers });
      return res.json({ success: true, user });
    }
    return res.status(404).json({ error: "User not found" });
  });

  app.post("/api/rooms", (req, res) => {
    const { rooms, roomId } = req.body;
    if (rooms && Array.isArray(rooms)) {
      const db = readDb();
      const currentRooms = db.rooms || [];

      let updatedRooms = [];
      if (roomId) {
        // If roomId is provided, only update the single room that was modified
        const targetIncomingRoom = rooms.find((r: any) => r.id === roomId);
        if (targetIncomingRoom) {
          const roomsMap = new Map();
          currentRooms.forEach((r: any) => {
            if (r && r.id) roomsMap.set(r.id, r);
          });
          roomsMap.set(roomId, targetIncomingRoom);
          updatedRooms = Array.from(roomsMap.values());
        } else {
          updatedRooms = currentRooms;
        }
      } else {
        // Fallback: merge rooms intelligently by comparing seated player count or activity
        const roomsMap = new Map();
        currentRooms.forEach((r: any) => {
          if (r && r.id) roomsMap.set(r.id, r);
        });

        rooms.forEach((r: any) => {
          if (r && r.id) {
            const existing = roomsMap.get(r.id);
            if (!existing) {
              roomsMap.set(r.id, r);
            } else {
              // Prefer rooms with active seats or games
              const existingHasPlayers = (existing.seatedPlayers && existing.seatedPlayers.length > 0);
              const incomingHasPlayers = (r.seatedPlayers && r.seatedPlayers.length > 0);
              if (incomingHasPlayers || !existingHasPlayers) {
                roomsMap.set(r.id, r);
              }
            }
          }
        });
        updatedRooms = Array.from(roomsMap.values());
      }

      writeDb({ rooms: updatedRooms });
      res.json({ success: true, rooms: updatedRooms });
    } else {
      res.status(400).json({ error: "Missing rooms" });
    }
  });

  app.post("/api/scores", (req, res) => {
    const { scores } = req.body;
    if (scores && Array.isArray(scores)) {
      const db = readDb();
      const currentScores = db.scores || [];

      // Merge scores based on unique gameId
      const scoreMap = new Map();
      currentScores.forEach((s: any) => {
        if (s && s.id) scoreMap.set(s.id, s);
      });
      scores.forEach((s: any) => {
        if (s && s.id) scoreMap.set(s.id, s);
      });

      const mergedScores = Array.from(scoreMap.values());
      writeDb({ scores: mergedScores });
      res.json({ success: true, scores: mergedScores });
    } else {
      res.status(400).json({ error: "Missing scores" });
    }
  });

  // Vite middleware setup for development, static serve for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
