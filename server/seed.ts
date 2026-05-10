import { db } from './db';
import { v4 as uuidv4 } from 'uuid';

export function seedData() {
  const contactCount = db.prepare('SELECT COUNT(*) as count FROM contacts').get() as { count: number };
  if (contactCount.count > 0) return;

  console.log('Seeding initial data...');

  const insertContact = db.prepare('INSERT INTO contacts (id, name, email) VALUES (?, ?, ?)');
  const insertTemplate = db.prepare('INSERT INTO templates (id, name, subject, body_md) VALUES (?, ?, ?, ?)');
  const insertCampaign = db.prepare('INSERT INTO campaigns (id, name, template_id, sender_name, sender_email) VALUES (?, ?, ?, ?, ?)');
  const insertReminder = db.prepare('INSERT INTO reminders (id, title, contact_id, campaign_id, start_at_utc) VALUES (?, ?, ?, ?, ?)');

  const contact1Id = uuidv4();
  const contact2Id = uuidv4();
  const templateId = uuidv4();
  const campaignId = uuidv4();

  const runSeed = db.transaction(() => {
    insertContact.run(contact1Id, 'John Doe', 'john@example.com');
    insertContact.run(contact2Id, 'Jane Smith', 'jane@example.com');

    insertTemplate.run(
      templateId, 
      'Welcome Sequence', 
      'Hi {{name}}, welcome to our platform!', 
      '# Welcome {{name}}!\n\nWe are glad to have you with us.\n\nBest,\nAutomated System'
    );

    insertCampaign.run(
      campaignId,
      'Onboarding',
      templateId,
      'Remindly Support',
      'support@remindly.test'
    );

    insertReminder.run(
      uuidv4(),
      'Follow up with John',
      contact1Id,
      campaignId,
      new Date().toISOString()
    );
  });

  runSeed();
  console.log('Seed completed.');
}
