/**
 * Email content builders for booking notifications.
 *
 * Plain template-string rendering — one place, zero extra dependencies (no
 * handlebars/mjml). Styles are inlined because email clients strip <style>.
 */

/** The subset of BookingsService.toResponse() output that emails render. */
export interface BookingEmailData {
  code: string;
  status: string;
  startDate: string;
  endDate: string;
  rentalDays: number;
  currency: string;
  totalPrice: number;
  createdAt?: string;
  contact: {
    fullName: string;
    phone: string;
    email: string;
    note?: string | null;
  };
  items: Array<{
    quantity: number;
    startDate: string;
    endDate: string;
    dailyRate: number;
    lineTotal: number;
    // name_snapshot is jsonb {vi,en}; occasionally a plain string or null.
    name?: { vi?: string; en?: string } | string | null;
  }>;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Product name_snapshot is jsonb {vi,en} (or a plain string). Prefer Vietnamese. */
function pickName(name: BookingEmailData['items'][number]['name']): string {
  if (!name) return '—';
  if (typeof name === 'string') return name;
  return name.vi ?? name.en ?? '—';
}

/** VND formatting — the only currency the shop uses. */
function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' for human-friendly display. */
function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/** Escape customer-supplied text before embedding in HTML (anti-injection). */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function itemRowsHtml(items: BookingEmailData['items']): string {
  return items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${esc(pickName(it.name))}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${it.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap;">${formatDate(it.startDate)} → ${formatDate(it.endDate)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${formatVnd(it.dailyRate)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${formatVnd(it.lineTotal)}</td>
      </tr>`,
    )
    .join('');
}

function itemsText(items: BookingEmailData['items']): string {
  return items
    .map(
      (it) =>
        `- ${pickName(it.name)} x${it.quantity} | ${formatDate(it.startDate)} → ${formatDate(it.endDate)} | ${formatVnd(it.lineTotal)}`,
    )
    .join('\n');
}

const WRAP_OPEN =
  '<div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:640px;margin:0 auto;">';
const WRAP_CLOSE = '</div>';

function itemsTableHtml(b: BookingEmailData): string {
  return `
    <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;">
      <thead>
        <tr style="background:#f5f5f5;text-align:left;">
          <th style="padding:8px;">Sản phẩm</th>
          <th style="padding:8px;text-align:center;">SL</th>
          <th style="padding:8px;">Thời gian thuê</th>
          <th style="padding:8px;text-align:right;">Giá/ngày</th>
          <th style="padding:8px;text-align:right;">Thành tiền</th>
        </tr>
      </thead>
      <tbody>${itemRowsHtml(b.items)}</tbody>
      <tfoot>
        <tr>
          <td colspan="4" style="padding:8px;text-align:right;font-weight:bold;">Tổng cộng</td>
          <td style="padding:8px;text-align:right;font-weight:bold;">${formatVnd(b.totalPrice)}</td>
        </tr>
      </tfoot>
    </table>`;
}

/** Admin notification — sent when a new booking is created (status PENDING). */
export function renderAdminNewBookingEmail(b: BookingEmailData): RenderedEmail {
  const subject = `[Camping] Đơn mới ${b.code} — ${b.contact.fullName}`;
  const html = `${WRAP_OPEN}
    <h2 style="margin:0 0 4px;">🏕️ Đơn hàng mới: ${esc(b.code)}</h2>
    <p style="color:#666;margin:0 0 16px;">Trạng thái: <strong>${esc(b.status)}</strong> · Thuê ${formatDate(b.startDate)} → ${formatDate(b.endDate)} (${b.rentalDays} ngày)</p>
    <h3 style="margin:0 0 4px;">Thông tin khách hàng</h3>
    <p style="margin:0 0 16px;line-height:1.6;">
      <strong>Họ tên:</strong> ${esc(b.contact.fullName)}<br/>
      <strong>Điện thoại:</strong> ${esc(b.contact.phone)}<br/>
      <strong>Email:</strong> ${esc(b.contact.email)}${
        b.contact.note ? `<br/>\n      <strong>Ghi chú:</strong> ${esc(b.contact.note)}` : ''
      }
    </p>
    <h3 style="margin:0 0 4px;">Chi tiết đơn</h3>
    ${itemsTableHtml(b)}
    <p style="color:#888;font-size:12px;margin-top:24px;">Email tự động từ hệ thống Camping Rental.</p>
  ${WRAP_CLOSE}`;
  const noteLine = b.contact.note ? `\nGhi chú: ${b.contact.note}` : '';
  const text = `Đơn hàng mới: ${b.code} (${b.status})
Thuê: ${formatDate(b.startDate)} → ${formatDate(b.endDate)} (${b.rentalDays} ngày)

Khách: ${b.contact.fullName}
Điện thoại: ${b.contact.phone}
Email: ${b.contact.email}${noteLine}

Sản phẩm:
${itemsText(b.items)}

Tổng cộng: ${formatVnd(b.totalPrice)}`;
  return { subject, html, text };
}

/** Customer confirmation — sent when the admin moves the booking to CONFIRMED. */
export function renderCustomerConfirmationEmail(
  b: BookingEmailData,
): RenderedEmail {
  const subject = `Đơn hàng ${b.code} đã được xác nhận — Camping Rental`;
  const html = `${WRAP_OPEN}
    <h2 style="margin:0 0 4px;">Cảm ơn bạn, ${esc(b.contact.fullName)}! 🏕️</h2>
    <p style="line-height:1.6;margin:0 0 16px;">Đơn thuê đồ camping <strong>${esc(b.code)}</strong> của bạn đã được <strong>xác nhận</strong>. Dưới đây là chi tiết đơn hàng:</p>
    <p style="color:#666;margin:0 0 12px;">Thời gian thuê: <strong>${formatDate(b.startDate)} → ${formatDate(b.endDate)}</strong> (${b.rentalDays} ngày)</p>
    ${itemsTableHtml(b)}
    <p style="line-height:1.6;margin:16px 0 0;">Chúng tôi sẽ liên hệ với bạn qua số điện thoại <strong>${esc(b.contact.phone)}</strong> để sắp xếp nhận đồ. Nếu cần hỗ trợ, bạn chỉ cần trả lời email này.</p>
    <p style="color:#888;font-size:12px;margin-top:24px;">Camping Rental — cảm ơn bạn đã tin tưởng!</p>
  ${WRAP_CLOSE}`;
  const text = `Cảm ơn bạn, ${b.contact.fullName}!

Đơn thuê đồ camping ${b.code} của bạn đã được XÁC NHẬN.
Thời gian thuê: ${formatDate(b.startDate)} → ${formatDate(b.endDate)} (${b.rentalDays} ngày)

Sản phẩm:
${itemsText(b.items)}

Tổng cộng: ${formatVnd(b.totalPrice)}

Chúng tôi sẽ liên hệ với bạn qua số ${b.contact.phone} để sắp xếp nhận đồ.
Camping Rental`;
  return { subject, html, text };
}
