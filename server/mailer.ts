import nodemailer from 'nodemailer';
import { db } from './db';

const DRY_RUN = process.env.DRY_RUN !== 'false';

export class Mailer {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (!DRY_RUN) {
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;

      if (!user || !pass) {
        console.warn('[MAILER] SMTP credentials missing. Defaulting to Simulated Mode.');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: { user, pass },
      });
    }
  }

  async send(fromName: string, fromEmail: string, toEmail: string, subject: string, html: string) {
    if (DRY_RUN || !this.transporter) {
      console.log(`[SIMULATED] Content for ${toEmail}:`);
      console.log(`Subject: ${subject}`);
      return { ok: true, mode: 'simulated' };
    }

    if (!this.transporter) {
      throw new Error('Mailer not initialized for production mode');
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: toEmail,
        subject: subject,
        html: html,
      });

      console.log(`SENT → ${toEmail}: ${info.messageId}`);
      return { ok: true, messageId: info.messageId };
    } catch (error) {
      console.error(`FAILED → ${toEmail}:`, error);
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
