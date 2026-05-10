import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import { spawn } from "child_process";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { db, initDb } from "./server/db";
import { seedData } from "./server/seed";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

// Ensure required directories exist
const LOGS_DIR = path.join(process.cwd(), 'logs');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
try {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
} catch (e) {
  console.error("[SYSTEM] Failed to create directories:", e);
}

const upload = multer({ dest: 'uploads/' });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize DB
  initDb();
  seedData();

  app.use(cors());
  app.use(express.json());

  // Python Worker Management
  let workerProcess: any = null;
  const startWorker = () => {
    console.log("[SYSTEM] Attempting to start Python Worker...");
    try {
      workerProcess = spawn('python3', ['worker.py'], {
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });
      
      workerProcess.on('error', (err: any) => {
        console.error(`[SYSTEM] Failed to spawn worker: ${err.message}. Running Node.js fallback worker.`);
        runNodeWorker();
      });

      workerProcess.stdout.on('data', (data: any) => console.log(`[WORKER] ${data}`));
      workerProcess.stderr.on('data', (data: any) => console.error(`[WORKER ERROR] ${data}`));
      workerProcess.on('close', (code: any) => {
        if (code !== 0) {
            console.log(`[SYSTEM] Worker exited with code ${code}. Restarting in 10s...`);
            setTimeout(startWorker, 10000);
        }
      });
    } catch (err: any) {
      console.error(`[SYSTEM] Spawn crashed: ${err.message}. Running Node.js fallback worker.`);
      runNodeWorker();
    }
  };

  // Node.js Fallback Worker (In case python3 is missing)
  const runNodeWorker = () => {
    setInterval(() => {
        const now = new Date().toISOString();
        try {
            const due = db.prepare(`
                SELECT r.*, c.name as contact_name, c.email as contact_email, 
                       cam.name as campaign_name, cam.sender_name, cam.sender_email,
                       t.subject, t.body_md
                FROM reminders r
                JOIN contacts c ON r.contact_id = c.id
                JOIN campaigns cam ON r.campaign_id = cam.id
                JOIN templates t ON cam.template_id = t.id
                WHERE r.active = 1 
                AND r.start_at_utc <= ?
            `).all(now) as any[];

            for (const r of due) {
                console.log(`[NODE-WORKER] Processing ${r.title}`);
                const subject = (r.subject || "").replace("{{name}}", r.contact_name);
                const body = (r.body_md || "").replace("{{name}}", r.contact_name);
                
                db.prepare(`
                    INSERT INTO messages (id, campaign_id, contact_id, scheduled_at_utc, sent_at_utc, status, subject, body_rendered_html)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(uuidv4(), r.campaign_id, r.contact_id, r.start_at_utc, now, 'sent', subject, body);

                db.prepare("UPDATE reminders SET active = 0, last_fired_at_utc = ? WHERE id = ?").run(now, r.id);
            }
        } catch (e) {
            console.error("[NODE-WORKER] Tick failed:", e);
        }
    }, 15000);
  };

  startWorker();

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", worker: !!workerProcess });
  });

  // Config & Dry Run
  app.get("/api/config", (req, res) => {
    res.json({
      dry_run: process.env.DRY_RUN !== 'false',
      smtp_user: process.env.SMTP_USER || 'Not Configured',
      smtp_host: process.env.SMTP_HOST || 'smtp.gmail.com'
    });
  });

  app.post("/api/config/toggle-dry-run", (req, res) => {
    process.env.DRY_RUN = process.env.DRY_RUN === 'false' ? 'true' : 'false';
    // Restart worker to apply changes
    if (workerProcess) workerProcess.kill();
    res.json({ dry_run: process.env.DRY_RUN !== 'false' });
  });

  // CSV Imports
  app.post("/api/upload/contacts", upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const content = fs.readFileSync(req.file.path, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    let imported = 0;
    
    // Simple CSV parser for name,email,timezone
    lines.forEach((line, index) => {
      if (index === 0 && line.toLowerCase().includes('name')) return; // Header
      const [name, email, timezone] = line.split(',').map(s => s.trim());
      if (name && email) {
        try {
          db.prepare("INSERT INTO contacts (id, name, email, timezone) VALUES (?, ?, ?, ?)").run(
            uuidv4(), name, email, timezone || 'Asia/Kolkata'
          );
          imported++;
        } catch (e) {}
      }
    });

    fs.unlinkSync(req.file.path);
    res.json({ success: true, count: imported });
  });

  app.post("/api/upload/reminders", upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const content = fs.readFileSync(req.file.path, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    let imported = 0;
    
    // Header should be title,contact_id,campaign_id,start_date,start_time
    lines.forEach((line, index) => {
      if (index === 0 && line.toLowerCase().includes('title')) return;
      const [title, contact_id, campaign_id, start_date, start_time, rrule] = line.split(',').map(s => s.trim());
      if (title && contact_id && campaign_id) {
        try {
          const start_at = `${start_date}T${start_time}:00.000Z`;
          db.prepare("INSERT INTO reminders (id, title, contact_id, campaign_id, start_at_utc, rrule) VALUES (?, ?, ?, ?, ?, ?)").run(
            uuidv4(), title, contact_id, campaign_id, start_at, rrule || ''
          );
          imported++;
        } catch (e) {}
      }
    });

    fs.unlinkSync(req.file.path);
    res.json({ success: true, count: imported });
  });

  // Logs & Reports
  app.get("/api/logs", (req, res) => {
    const files = fs.readdirSync(LOGS_DIR);
    res.json(files.filter(f => f.endsWith('.csv')));
  });

  app.get("/api/logs/:filename", (req, res) => {
    const filePath = path.join(LOGS_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).send("File not found");
    res.sendFile(filePath);
  });

  // Contacts
  app.get("/api/contacts", (req, res) => {
    const contacts = db.prepare("SELECT * FROM contacts").all();
    res.json(contacts);
  });

  app.post("/api/contacts", (req, res) => {
    const { name, email, timezone } = req.body;
    const id = uuidv4();
    try {
      db.prepare("INSERT INTO contacts (id, name, email, timezone) VALUES (?, ?, ?, ?)").run(id, name, email, timezone || 'Asia/Kolkata');
      res.json({ id, name, email });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/contacts/:id", (req, res) => {
    const { id } = req.params;
    const { name, email, timezone } = req.body;
    try {
      db.prepare("UPDATE contacts SET name = ?, email = ?, timezone = ? WHERE id = ?").run(name, email, timezone || 'Asia/Kolkata', id);
      res.json({ id, name, email });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Templates
  app.get("/api/templates", (req, res) => {
    const templates = db.prepare("SELECT * FROM templates").all();
    res.json(templates);
  });

  app.post("/api/templates", (req, res) => {
    const { name, subject, body_md } = req.body;
    const id = uuidv4();
    db.prepare("INSERT INTO templates (id, name, subject, body_md) VALUES (?, ?, ?, ?)").run(id, name, subject, body_md);
    res.json({ id, name });
  });

  // Campaigns
  app.get("/api/campaigns", (req, res) => {
    const campaigns = db.prepare("SELECT * FROM campaigns").all();
    res.json(campaigns);
  });

  app.post("/api/campaigns", (req, res) => {
    const { name, template_id, sender_name, sender_email } = req.body;
    const id = uuidv4();
    db.prepare("INSERT INTO campaigns (id, name, template_id, sender_name, sender_email) VALUES (?, ?, ?, ?, ?)").run(id, name, template_id, sender_name, sender_email);
    res.json({ id, name });
  });

  // Reminders
  app.get("/api/reminders", (req, res) => {
    const reminders = db.prepare(`
      SELECT r.*, c.name as contact_name, cam.name as campaign_name 
      FROM reminders r
      JOIN contacts c ON r.contact_id = c.id
      JOIN campaigns cam ON r.campaign_id = cam.id
    `).all();
    res.json(reminders);
  });

  app.post("/api/reminders", (req, res) => {
    const { title, contact_id, campaign_id, start_at_utc, rrule } = req.body;
    const id = uuidv4();
    db.prepare("INSERT INTO reminders (id, title, contact_id, campaign_id, start_at_utc, rrule) VALUES (?, ?, ?, ?, ?, ?)").run(id, title, contact_id, campaign_id, start_at_utc, rrule);
    res.json({ id, title });
  });

  app.patch("/api/reminders/:id/toggle", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("UPDATE reminders SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Messages / Reports
  app.get("/api/messages", (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const messages = db.prepare(`
      SELECT m.*, c.name as contact_name, cam.name as campaign_name 
      FROM messages m
      JOIN contacts c ON m.contact_id = c.id
      JOIN campaigns cam ON m.campaign_id = cam.id
      ORDER BY m.scheduled_at_utc DESC
      LIMIT ?
    `).all(limit);
    res.json(messages);
  });

  app.get("/api/stats", (req, res) => {
    const stats = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM messages WHERE status = 'sent') as sent,
        (SELECT COUNT(*) FROM messages WHERE status = 'failed') as failed,
        (SELECT COUNT(*) FROM messages WHERE status = 'scheduled') as pending,
        (SELECT COUNT(*) FROM contacts) as total_contacts
    `).get();
    res.json(stats);
  });

  app.post("/api/sync", async (req, res) => {
    try {
      const stats = db.prepare(`SELECT 
          (SELECT COUNT(*) FROM messages WHERE status = 'sent') as sent,
          (SELECT COUNT(*) FROM messages WHERE status = 'failed') as failed,
          (SELECT COUNT(*) FROM messages WHERE status = 'scheduled') as pending,
          (SELECT COUNT(*) FROM contacts) as total_contacts`).get();
      const contacts = db.prepare("SELECT * FROM contacts LIMIT 50").all();
      const reminders = db.prepare(`SELECT r.*, c.name as contact_name, cam.name as campaign_name FROM reminders r JOIN contacts c ON r.contact_id = c.id JOIN campaigns cam ON r.campaign_id = cam.id LIMIT 50`).all();
      const messages = db.prepare(`SELECT m.*, c.name as contact_name, cam.name as campaign_name FROM messages m JOIN contacts c ON m.contact_id = c.id JOIN campaigns cam ON m.campaign_id = cam.id ORDER BY m.scheduled_at_utc DESC LIMIT 20`).all();
      res.json({ stats, contacts, reminders, messages });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/init", (req, res) => {
    try {
      const stats = db.prepare(`
        SELECT 
          (SELECT COUNT(*) FROM messages WHERE status = 'sent') as sent,
          (SELECT COUNT(*) FROM messages WHERE status = 'failed') as failed,
          (SELECT COUNT(*) FROM messages WHERE status = 'scheduled') as pending,
          (SELECT COUNT(*) FROM contacts) as total_contacts
      `).get();

      const contacts = db.prepare("SELECT * FROM contacts LIMIT 50").all();
      const reminders = db.prepare(`
        SELECT r.*, c.name as contact_name, cam.name as campaign_name 
        FROM reminders r
        JOIN contacts c ON r.contact_id = c.id
        JOIN campaigns cam ON r.campaign_id = cam.id
        LIMIT 50
      `).all();
      const messages = db.prepare(`
        SELECT m.*, c.name as contact_name, cam.name as campaign_name 
        FROM messages m
        JOIN contacts c ON m.contact_id = c.id
        JOIN campaigns cam ON m.campaign_id = cam.id
        ORDER BY m.scheduled_at_utc DESC
        LIMIT 20
      `).all();

      res.json({ stats, contacts, reminders, messages });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
