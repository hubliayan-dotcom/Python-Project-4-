import pkg from 'rrule';
const { RRule, rrulestr } = pkg;
import { db } from './db';
import type { Reminder, Contact, Campaign, Template, Message } from './db';
import { renderEmail } from './renderer';
import { Mailer } from './mailer';
import { v4 as uuidv4 } from 'uuid';

export function planNextFires(now: Date) {
  // Find all active reminders
  const reminders = db.prepare('SELECT * FROM reminders WHERE active = 1').all() as Reminder[];

  for (const reminder of reminders) {
    try {
      const startAt = new Date(reminder.start_at_utc);
      const lastFired = reminder.last_fired_at_utc ? new Date(reminder.last_fired_at_utc) : null;
      
      let nextFire: Date | null = null;

      if (!reminder.rrule) {
        // One-time reminder
        if (!lastFired && startAt <= now) {
          nextFire = startAt;
        }
      } else {
        // Recurring reminder
        const rule = rrulestr(reminder.rrule, { dtstart: startAt });
        // Find next fire after the later of (lastFired or startAt-1ms)
        const afterDate = lastFired ? lastFired : new Date(startAt.getTime() - 1);
        nextFire = rule.after(afterDate);
        
        // Only fire if nextFire is now or in the past
        if (nextFire && nextFire > now) {
          nextFire = null;
        }
      }

      if (nextFire) {
        // Prepare the message
        const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(reminder.contact_id) as Contact;
        const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(reminder.campaign_id) as Campaign;
        const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(campaign.template_id) as Template;

        if (!contact || contact.unsubscribed) continue;

        const { subject, html } = renderEmail(template.subject, template.body_md, {
          name: contact.name,
          email: contact.email,
          title: reminder.title,
          now: now.toISOString()
        });

        const messageId = uuidv4();
        db.prepare(`
          INSERT INTO messages (id, campaign_id, contact_id, scheduled_at_utc, status, subject, body_rendered_html)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          messageId,
          campaign.id,
          contact.id,
          nextFire.toISOString(),
          'scheduled',
          subject,
          html
        );

        // Update reminder last fired time to avoid duplicates
        db.prepare('UPDATE reminders SET last_fired_at_utc = ? WHERE id = ?').run(
          nextFire.toISOString(),
          reminder.id
        );

        console.log(`Planned fire for reminder "${reminder.title}" at ${nextFire.toISOString()}`);
      }
    } catch (error) {
      console.error(`Error planning fire for reminder ${reminder.id}:`, error);
    }
  }
}

export async function dispatchDue(now: Date, mailer: Mailer) {
  const dueMessages = db.prepare(`
    SELECT m.*, c.sender_name, c.sender_email, con.email as contact_email
    FROM messages m
    JOIN campaigns c ON m.campaign_id = c.id
    JOIN contacts con ON m.contact_id = con.id
    WHERE m.status = 'scheduled' AND m.scheduled_at_utc <= ?
  `).all(now.toISOString()) as (Message & { sender_name: string; sender_email: string; contact_email: string })[];

  for (const msg of dueMessages) {
    const result = await mailer.send(
      msg.sender_name,
      msg.sender_email,
      msg.contact_email,
      msg.subject,
      msg.body_rendered_html
    );

    if (result.ok) {
      db.prepare('UPDATE messages SET status = ?, sent_at_utc = ? WHERE id = ?').run(
        'sent',
        new Date().toISOString(),
        msg.id
      );
    } else {
      db.prepare('UPDATE messages SET status = ?, error = ? WHERE id = ?').run(
        'failed',
        result.error,
        msg.id
      );
    }
  }
}
