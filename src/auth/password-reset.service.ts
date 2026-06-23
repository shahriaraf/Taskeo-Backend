// src/auth/password-reset.service.ts
// This service handles the forgot-password / reset-password flow.
// It lives separately from AuthService to keep that file focused.

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private configService: ConfigService,
  ) {}

  /**
   * Step 1 — User requests a password reset.
   *
   * We always return the same success message regardless of whether the email
   * exists. This prevents user enumeration (attackers finding valid emails).
   */
  async requestReset(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && user.isActive) {
      // Delete any existing unused tokens for this user first
      await this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });

      // Generate a cryptographically secure random token
      const rawToken = crypto.randomBytes(32).toString('hex');

      // Store only the SHA-256 hash of the token in the database.
      // The raw token is sent by email. Even if the DB is breached,
      // the attacker cannot use the hash to reset a password.
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: tokenHash,
          expiresAt: new Date(Date.now() + this.TOKEN_TTL_MS),
        },
      });

      // Send email in the background — do not await so the response is instant
      this.mailService
        .sendPasswordReset(user.email, user.name, rawToken)
        .catch((err) => this.logger.error('Failed to send reset email', err));
    }

    // Always return the same message
    return {
      message: 'If this email is registered, a password reset link has been sent.',
    };
  }

  /**
   * Step 2 — User submits the new password with the token from their email.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<{ message: string }> {
    // Hash the incoming token to look it up in the DB
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const resetRecord = await this.prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!resetRecord) {
      throw new BadRequestException('This reset link is invalid or has already been used.');
    }

    if (resetRecord.usedAt) {
      throw new BadRequestException('This reset link has already been used. Please request a new one.');
    }

    if (new Date() > resetRecord.expiresAt) {
      // Clean up the expired token
      await this.prisma.passwordResetToken.delete({ where: { id: resetRecord.id } });
      throw new BadRequestException('This reset link has expired. Please request a new one.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and mark token as used in a single transaction
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Notify the user that their password was changed
    this.mailService
      .sendPasswordChanged(resetRecord.user.email, resetRecord.user.name)
      .catch((err) => this.logger.error('Failed to send password-changed email', err));

    this.logger.log(`Password reset successful for user ${resetRecord.userId}`);
    return { message: 'Password has been reset successfully. You can now log in.' };
  }
}
