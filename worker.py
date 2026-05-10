import sqlite3
import smtplib
import os
import time
import csv
import json
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path

# --- Configuration ---
DB_PATH = "email.db"
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

# Environment variables (typically provided by server.ts via .env or directly)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"

def log_event(status, subject, recipient, error=None):
    log_file = LOG_DIR / f"delivery_{datetime.now().strftime('%Y-%m-%d')}.csv"
    file_exists = log_file.exists()
    with open(log_file, "a", newline="") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["timestamp", "status", "recipient", "subject", "error"])
        writer.writerow([datetime.now(timezone.utc).isoformat(), status, recipient, subject, error])

def send_email(to_email, subject, body, sender_name, sender_email):
    if DRY_RUN:
        print(f"[DRY RUN] Would send email to {to_email}: {subject}")
        log_event("simulated_sent", subject, to_email)
        return True, None

    try:
        msg = EmailMessage()
        msg.set_content(body)
        msg['Subject'] = subject
        msg['From'] = f"{sender_name} <{sender_email}>"
        msg['To'] = to_email

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        
        log_event("sent", subject, to_email)
        return True, None
    except Exception as e:
        print(f"Error sending email: {e}")
        log_event("failed", subject, to_email, str(e))
        return False, str(e)

def process_reminders():
    print(f"Checking for due reminders at {datetime.now()}...")
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Get pending reminders that are ready to fire
        now_utc = datetime.now(timezone.utc).isoformat()
        cursor.execute("""
            SELECT r.*, c.name as contact_name, c.email as contact_email, 
                   cam.name as campaign_name, cam.sender_name, cam.sender_email,
                   t.subject, t.body_md
            FROM reminders r
            JOIN contacts c ON r.contact_id = c.id
            JOIN campaigns cam ON r.campaign_id = cam.id
            JOIN templates t ON cam.template_id = t.id
            WHERE r.active = 1 
            AND r.start_at_utc <= ?
        """, (now_utc,))

        reminders = cursor.fetchall()
        for r in reminders:
            print(f"Processing reminder: {r['title']} for {r['contact_name']}")

            # Personalize
            subject = r['subject'].replace("{{name}}", r['contact_name'])
            body = r['body_md'].replace("{{name}}", r['contact_name'])

            # Send
            success, error = send_email(r['contact_email'], subject, body, r['sender_name'], r['sender_email'])

            # Record in messages table
            cursor.execute("""
                INSERT INTO messages (id, campaign_id, contact_id, scheduled_at_utc, sent_at_utc, status, subject, body_rendered_html, error)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                os.urandom(8).hex(),
                r['campaign_id'],
                r['contact_id'],
                r['start_at_utc'],
                now_utc if success else None,
                'sent' if success else 'failed',
                subject,
                body,
                error
            ))

            # Update reminder status (one-time logic for now, could be expanded for RRule)
            cursor.execute("UPDATE reminders SET active = 0, last_fired_at_utc = ? WHERE id = ?", (now_utc, r['id']))
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Worker Error: {e}")

def main():
    print(f"Worker started. Dry Run: {DRY_RUN}")
    while True:
        process_reminders()
        time.sleep(10) # Check every 10 seconds

if __name__ == "__main__":
    main()
