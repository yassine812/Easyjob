import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: string; contentType: string }[];
}

export abstract class EmailProvider {
  abstract send(message: EmailMessage): Promise<void>;
}

/**
 * Development provider: logs the email instead of sending it. In test mode
 * (NODE_ENV=test) every email is also captured in `sentEmails` so tests can
 * assert on email content and extract tokens from links.
 */
export class ConsoleEmailProvider extends EmailProvider {
  private readonly logger = new Logger('Email');
  static sentEmails: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(
      JSON.stringify({
        to: message.to,
        subject: message.subject,
        provider: 'console (not delivered)',
      }),
    );
    if (process.env.NODE_ENV === 'test') {
      ConsoleEmailProvider.sentEmails.push({ ...message });
    }
  }
}

/**
 * Production provider: SMTP via nodemailer.
 */
export class SmtpEmailProvider extends EmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? 'localhost',
        port: parseInt(process.env.SMTP_PORT ?? '587', 10),
        secure: (process.env.SMTP_SECURE ?? 'false') === 'true',
        connectionTimeout: 15_000,
        socketTimeout: 30_000,
        auth:
          process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
            : undefined,
      });
    }
    return this.transporter;
  }

  async send(message: EmailMessage): Promise<void> {
    const from = process.env.SMTP_FROM ?? process.env.EMAIL_FROM ?? 'Startup Starter <no-reply@startupstarter.app>';
    await this.getTransporter().sendMail({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: message.attachments,
    });
  }
}
