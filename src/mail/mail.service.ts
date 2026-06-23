// src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;
  private readonly fromAddress: string;
  private readonly appName = 'Taskeo';
  private readonly frontendUrl: string;

  constructor(private configService: ConfigService) {
    this.fromAddress = this.configService.get<string>('mail.from') ?? `noreply@taskeo.app`;
    this.frontendUrl = this.configService.get<string>('app.frontendUrl') ?? 'http://localhost:3001';

    this.transporter = nodemailer.createTransport({
      host:   this.configService.get<string>('mail.host'),
      port:   this.configService.get<number>('mail.port') ?? 587,
      secure: this.configService.get<boolean>('mail.secure') ?? false,
      auth: {
        user: this.configService.get<string>('mail.user'),
        pass: this.configService.get<string>('mail.pass'),
      },
    });
  }

  // ── Forgot password ───────────────────────────────────
  async sendPasswordReset(to: string, name: string, resetToken: string): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${resetToken}`;

    await this.send({
      to,
      subject: `Reset your ${this.appName} password`,
      html: this.wrapTemplate(`
        <h2 style="margin:0 0 16px">Reset your password</h2>
        <p style="margin:0 0 8px">Hi ${this.escape(name)},</p>
        <p style="margin:0 0 24px">We received a request to reset your password. Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetUrl}" style="${this.btnStyle()}">Reset Password</a>
        <p style="margin:24px 0 0;font-size:13px;color:#9ea4b8">
          If you did not request this, you can safely ignore this email — your password will not change.
        </p>
        <p style="margin:8px 0 0;font-size:12px;color:#9ea4b8">
          Or copy this link: <a href="${resetUrl}" style="color:#4f8ef7">${resetUrl}</a>
        </p>
      `),
    });
  }

  // ── Task assigned ─────────────────────────────────────
  async sendTaskAssigned(opts: {
    to: string;
    assigneeName: string;
    taskTitle: string;
    projectName: string;
    taskId: string;
    dueDate: string;
    assignedByName: string;
  }): Promise<void> {
    const taskUrl = `${this.frontendUrl}/tasks/${opts.taskId}`;

    await this.send({
      to: opts.to,
      subject: `New task assigned: ${opts.taskTitle}`,
      html: this.wrapTemplate(`
        <h2 style="margin:0 0 16px">You have a new task</h2>
        <p style="margin:0 0 8px">Hi ${this.escape(opts.assigneeName)},</p>
        <p style="margin:0 0 24px">
          <strong>${this.escape(opts.assignedByName)}</strong> assigned you a task in 
          <strong>${this.escape(opts.projectName)}</strong>.
        </p>
        ${this.infoCard([
          ['Task',    opts.taskTitle],
          ['Project', opts.projectName],
          ['Due',     opts.dueDate],
          ['Assigned by', opts.assignedByName],
        ])}
        <a href="${taskUrl}" style="${this.btnStyle()}">View Task</a>
      `),
    });
  }

  // ── Deadline reminder (24 hours before) ──────────────
  async sendDeadlineReminder(opts: {
    to: string;
    name: string;
    taskTitle: string;
    projectName: string;
    taskId: string;
    dueDate: string;
  }): Promise<void> {
    const taskUrl = `${this.frontendUrl}/tasks/${opts.taskId}`;

    await this.send({
      to: opts.to,
      subject: `⏰ Deadline tomorrow: ${opts.taskTitle}`,
      html: this.wrapTemplate(`
        <h2 style="margin:0 0 16px">Your task is due tomorrow</h2>
        <p style="margin:0 0 8px">Hi ${this.escape(opts.name)},</p>
        <p style="margin:0 0 24px">
          A task assigned to you is due in less than 24 hours.
        </p>
        ${this.infoCard([
          ['Task',    opts.taskTitle],
          ['Project', opts.projectName],
          ['Due',     opts.dueDate],
        ])}
        <a href="${taskUrl}" style="${this.btnStyle('amber')}">View Task</a>
      `),
    });
  }

  // ── New comment on your task ──────────────────────────
  async sendNewComment(opts: {
    to: string;
    assigneeName: string;
    commenterName: string;
    taskTitle: string;
    taskId: string;
    commentPreview: string;
  }): Promise<void> {
    const taskUrl = `${this.frontendUrl}/tasks/${opts.taskId}`;
    const preview = opts.commentPreview.length > 200
      ? opts.commentPreview.substring(0, 200) + '…'
      : opts.commentPreview;

    await this.send({
      to: opts.to,
      subject: `New comment on "${opts.taskTitle}"`,
      html: this.wrapTemplate(`
        <h2 style="margin:0 0 16px">New comment on your task</h2>
        <p style="margin:0 0 8px">Hi ${this.escape(opts.assigneeName)},</p>
        <p style="margin:0 0 24px">
          <strong>${this.escape(opts.commenterName)}</strong> commented on 
          <strong>${this.escape(opts.taskTitle)}</strong>.
        </p>
        <blockquote style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #4f8ef7;background:#1e2333;border-radius:0 8px 8px 0;font-style:italic;color:#ced4e4">
          ${this.escape(preview)}
        </blockquote>
        <a href="${taskUrl}" style="${this.btnStyle()}">View Comment</a>
      `),
    });
  }

  // ── Password changed confirmation ─────────────────────
  async sendPasswordChanged(to: string, name: string): Promise<void> {
    await this.send({
      to,
      subject: `Your ${this.appName} password was changed`,
      html: this.wrapTemplate(`
        <h2 style="margin:0 0 16px">Password changed</h2>
        <p style="margin:0 0 8px">Hi ${this.escape(name)},</p>
        <p style="margin:0 0 24px">Your ${this.appName} password was successfully changed.</p>
        <p style="margin:0;font-size:13px;color:#9ea4b8">
          If you did not make this change, please contact support immediately or 
          <a href="${this.frontendUrl}/forgot-password" style="color:#f87171">reset your password</a>.
        </p>
      `),
    });
  }

  // ── Internal send ─────────────────────────────────────
  private async send(opts: { to: string; subject: string; html: string }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"${this.appName}" <${this.fromAddress}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });
      this.logger.log(`Email sent to ${opts.to}: ${opts.subject}`);
    } catch (error) {
      // Log the error but don't throw — a failed email should never crash an API request
      this.logger.error(`Failed to send email to ${opts.to}: ${String(error)}`);
    }
  }

  // ── Template helpers ──────────────────────────────────
  private wrapTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0c0e14;font-family:'Segoe UI',Arial,sans-serif;color:#ffffff">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c0e14;padding:40px 0">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
        <!-- Header -->
        <tr><td style="background:#12151e;border-radius:14px 14px 0 0;padding:28px 32px;border-bottom:1px solid rgba(255,255,255,0.08)">
          <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px">⚡ Taskeo</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#12151e;padding:32px;font-size:15px;line-height:1.6;color:#ced4e4">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#0c0e14;border-radius:0 0 14px 14px;padding:20px 32px;text-align:center;font-size:12px;color:#525867">
          © ${new Date().getFullYear()} Taskeo. You're receiving this because you have an account.
          <br><a href="${this.frontendUrl}/settings" style="color:#4f8ef7;text-decoration:none">Manage notifications</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private infoCard(rows: [string, string][]): string {
    const rowsHtml = rows
      .map(
        ([label, value]) => `
        <tr>
          <td style="padding:8px 12px;font-size:13px;color:#9ea4b8;white-space:nowrap">${this.escape(label)}</td>
          <td style="padding:8px 12px;font-size:13px;color:#ffffff;font-weight:500">${this.escape(value)}</td>
        </tr>`,
      )
      .join('');
    return `<table style="width:100%;background:#1e2333;border-radius:8px;margin-bottom:24px;border-collapse:collapse">${rowsHtml}</table>`;
  }

  private btnStyle(color: 'blue' | 'amber' = 'blue'): string {
    const bg = color === 'amber' ? '#f59e0b' : '#4f8ef7';
    return `display:inline-block;padding:12px 24px;background:${bg};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px`;
  }

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
