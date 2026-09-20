import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

import { AppError } from './errors.js';
import { AppConfig } from './types.js';

let client: SESv2Client | null = null;

export type EmailSender = (config: AppConfig, message: OutboundEmail) => Promise<void>;

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

async function sendWithSes(config: AppConfig, message: OutboundEmail): Promise<void> {
  if (!config.sesFromEmail) {
    throw new AppError(
      'email_unavailable',
      'Email delivery is not configured (SES_FROM_EMAIL is unset)',
      503,
    );
  }

  client ??= new SESv2Client({ region: config.awsRegion ?? 'us-west-2' });

  try {
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: config.sesFromEmail,
        Destination: { ToAddresses: [message.to] },
        Content: {
          Simple: {
            Subject: { Data: message.subject, Charset: 'UTF-8' },
            Body: {
              Text: { Data: message.text, Charset: 'UTF-8' },
              ...(message.html ? { Html: { Data: message.html, Charset: 'UTF-8' } } : {}),
            },
          },
        },
      }),
    );
  } catch (error) {
    throw new AppError(
      'email_send_failed',
      `Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
      502,
    );
  }
}

let sender: EmailSender = sendWithSes;

export function sendEmail(config: AppConfig, message: OutboundEmail): Promise<void> {
  return sender(config, message);
}

export function isEmailDeliveryConfigured(config: AppConfig): boolean {
  return Boolean(config.sesFromEmail);
}

/** Test seam. */
export function setEmailSender(next: EmailSender | null): void {
  sender = next ?? sendWithSes;
}

export function buildOtpEmail(to: string, code: string, expiresMinutes: number): OutboundEmail {
  const subject = `${code} is your HNNT sign-in code`;
  const text = [
    `Your HNNT sign-in code is ${code}.`,
    `It expires in ${expiresMinutes} minutes.`,
    '',
    "If you didn't request this, you can ignore this email.",
  ].join('\n');
  const html = `<p>Your HNNT sign-in code is <strong style="font-size:20px;letter-spacing:2px">${code}</strong>.</p><p>It expires in ${expiresMinutes} minutes.</p><p style="color:#777">If you didn't request this, you can ignore this email.</p>`;
  return { to, subject, text, html };
}
