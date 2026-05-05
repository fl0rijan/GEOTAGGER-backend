import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly resend: Resend;
  private readonly logger = new Logger(MailService.name);
  private readonly fromEmail: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.getOrThrow<string>('RESEND_API_KEY');
    this.fromEmail = this.config.getOrThrow<string>('EMAIL');
    this.resend = new Resend(apiKey);
  }

  async sendVerificationEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<void> {
    const url = `${this.config.get('FRONTEND_URL')}/verify-email?token=${token}`;

    await this.sendEmail(
      email,
      'Verify your GeoTagger account',
      `<h1>Welcome, ${name}!</h1>
       <p>Please verify your email by clicking the link below:</p>
       <a href="${url}">Verify Email</a>
        <p>If you cannot click it, copy and paste it: ${url}</p>`,
    );
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<void> {
    const url = `${this.config.get('FRONTEND_URL')}/reset-password?token=${token}`;

    await this.sendEmail(
      email,
      'Reset your GeoTagger password',
      `<h1>Hi ${name},</h1>
       <p>You requested a password reset. Click the link below to set a new password:</p>
       <a href="${url}">Reset Password</a>
       <p>If you cannot click it, copy and paste it: ${url}</p>
       <p>This link will expire in 1 hour.</p>`,
    );
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
      });

      if (error) {
        this.logger.error(`Resend Error: ${error.message}`);
        throw new Error(error.message);
      }
    } catch (err) {
      this.logger.error('Failed to send email', err);

      throw new InternalServerErrorException('Could not send email');
    }
  }
}
