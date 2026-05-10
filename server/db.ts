import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'email.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      timezone TEXT DEFAULT 'Asia/Kolkata',
      unsubscribed BOOLEAN DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      subject TEXT,
      body_md TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT,
      template_id TEXT REFERENCES templates(id),
      sender_name TEXT,
      sender_email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      title TEXT,
      contact_id TEXT REFERENCES contacts(id),
      campaign_id TEXT REFERENCES campaigns(id),
      start_at_utc DATETIME,
      rrule TEXT,
      active BOOLEAN DEFAULT 1,
      last_fired_at_utc DATETIME
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      campaign_id TEXT,
      contact_id TEXT,
      scheduled_at_utc DATETIME,
      sent_at_utc DATETIME,
      status TEXT, -- 'scheduled', 'sent', 'failed'
      subject TEXT,
      body_rendered_html TEXT,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_messages_sched ON messages(scheduled_at_utc, status);
    CREATE INDEX IF NOT EXISTS idx_messages_campaign ON messages(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_contact ON reminders(contact_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_campaign ON reminders(campaign_id);
  `);
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  timezone: string;
  unsubscribed: number;
}

export interface Template {
  id: string;
  name: string;
  subject: string;
  body_md: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  template_id: string;
  sender_name: string;
  sender_email: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  title: string;
  contact_id: string;
  campaign_id: string;
  start_at_utc: string;
  rrule: string | null;
  active: number;
  last_fired_at_utc: string | null;
}

export interface Message {
  id: string;
  campaign_id: string;
  contact_id: string;
  scheduled_at_utc: string;
  sent_at_utc: string | null;
  status: string;
  subject: string;
  body_rendered_html: string;
  error: string | null;
}
