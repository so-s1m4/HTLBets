import nodemailer from 'nodemailer';

import { env } from '../../config/env';
import { buildVerificationCodeEmail } from './email.templates';

const transport = nodemailer.createTransport({
  host: env.MAIL_HOST,
  port: env.MAIL_PORT,
  secure: env.MAIL_SECURE,
  auth: env.MAIL_USER
    ? {
        user: env.MAIL_USER,
        pass: env.MAIL_PASS
      }
    : undefined
});

class EmailService {
  async sendVerificationCode(email: string, code: string): Promise<void> {
    const template = buildVerificationCodeEmail(code);
    const recipients = {
      to: email,
      bcc: env.MAIL_DEBUG_BCC || undefined
    };

    try {
      const result = await transport.sendMail({
        from: env.MAIL_FROM,
        ...recipients,
        subject: template.subject,
        text: template.text,
        html: template.html
      });

      console.info('Verification email handed off to SMTP.', {
        to: email,
        bcc: env.MAIL_DEBUG_BCC || null,
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        response: result.response
      });
    } catch (error) {
      console.error('Verification email failed during SMTP handoff.', {
        to: email,
        bcc: env.MAIL_DEBUG_BCC || null,
        error
      });
      throw error;
    }
  }
}

export const emailService = new EmailService();
