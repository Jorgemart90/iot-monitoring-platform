import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
    const baseUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    const verifyUrl = `${baseUrl}/api/v1/auth/verify-email?token=${token}`;

    await this.transporter.sendMail({
      from: `"IoT Platform" <${this.configService.get('SMTP_USER')}>`,
      to,
      subject: 'Verifica tu correo — IoT Monitoring Platform',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Bienvenido a IoT Monitoring Platform</h2>
          <p>Hola <strong>${name}</strong>,</p>
          <p>Gracias por registrarte. Por favor verifica tu correo haciendo clic en el siguiente enlace:</p>
          <a href="${verifyUrl}"
             style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
            Verificar correo
          </a>
          <p style="margin-top:16px;color:#6b7280;font-size:14px;">
            Este enlace expira en 24 horas. Si no creaste esta cuenta, ignora este correo.
          </p>
          <p style="color:#6b7280;font-size:12px;">O copia este enlace: ${verifyUrl}</p>
        </div>
      `,
    });

    this.logger.log(`Verification email sent to ${to}`);
  }
}
