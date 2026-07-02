import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingEmailData,
  RenderedEmail,
  renderAdminNewBookingEmail,
  renderCustomerConfirmationEmail,
} from './mail.templates';

/**
 * Sends transactional emails via the Resend HTTP API.
 *
 * Design notes:
 * - HTTP (not SMTP): serverless-friendly, no long-lived connection to keep open
 *   across Vercel cold/warm invocations.
 * - Every public method SWALLOWS its own errors (logs, never throws) so a mail
 *   failure can never break the booking flow that awaits it. Callers `await` us
 *   only so the request stays alive long enough for the send to finish before
 *   the serverless function freezes.
 * - Optional config: if RESEND_API_KEY / ADMIN_EMAIL are missing the feature
 *   silently no-ops (graceful degradation) — the app still boots and takes
 *   orders. Contrast SupabaseService, which uses getOrThrow for required keys.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey?: string;
  private readonly adminEmail?: string;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY');
    this.adminEmail = this.config.get<string>('ADMIN_EMAIL');
    this.from = this.config.get<string>(
      'MAIL_FROM',
      'Camping Rental <onboarding@resend.dev>',
    );
  }

  /** Notify the shop admin that a new (PENDING) booking has arrived. */
  async sendAdminNewBookingNotification(
    booking: BookingEmailData,
  ): Promise<void> {
    if (!this.apiKey || !this.adminEmail) {
      this.logger.warn(
        'Admin email skipped: RESEND_API_KEY hoặc ADMIN_EMAIL chưa cấu hình',
      );
      return;
    }
    try {
      await this.dispatch(this.adminEmail, renderAdminNewBookingEmail(booking));
      this.logger.log(`Admin notified: booking ${booking.code}`);
    } catch (err) {
      this.logger.error(
        `Notify admin failed for booking ${booking.code}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /** Confirm the booking to the customer once the admin sets it CONFIRMED. */
  async sendCustomerConfirmation(booking: BookingEmailData): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn('Customer email skipped: RESEND_API_KEY chưa cấu hình');
      return;
    }
    const to = booking.contact?.email;
    if (!to) return;
    try {
      await this.dispatch(to, renderCustomerConfirmationEmail(booking));
      this.logger.log(`Customer confirmed: booking ${booking.code}`);
    } catch (err) {
      this.logger.error(
        `Customer confirmation failed for booking ${booking.code}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /** POST a single email to Resend. Throws on network/timeout/non-2xx. */
  private async dispatch(to: string, email: RenderedEmail): Promise<void> {
    // Bound the wait so a slow Resend can't hang the request that awaits us.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [to],
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Resend ${res.status}: ${await res.text()}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
