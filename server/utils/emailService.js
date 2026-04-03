import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const PLATFORM_NAME = 'SOCIO';
const PLATFORM_URL = process.env.PUBLIC_APP_URL || 'https://socio.christuniversity.in';
const SUPPORT_EMAIL = process.env.EMAIL_REPLY_TO || 'support@socio.christuniversity.in';
const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || 'SOCIO <noreply@socio.christuniversity.in>';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFirstName(name) {
  const firstName = (name || '').trim().split(/\s+/)[0];
  return escapeHtml(firstName || 'there');
}

function formatDate(value, includeTime = false) {
  if (!value) return 'To be announced';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' } : {}),
  }).format(date);
}

function buildEmailShell({ preheader, eyebrow, title, intro, sections = [], ctaLabel, ctaUrl, footerNote }) {
  const sectionHtml = sections
    .map((section) => `
      <tr>
        <td style="padding: 0 0 16px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; border-spacing: 0; background: ${section.background || '#f8fafc'}; border: 1px solid ${section.border || '#e2e8f0'}; border-radius: 16px;">
            <tr>
              <td style="padding: 18px 20px;">
                ${section.heading ? `<p style="margin: 0 0 8px 0; color: ${section.headingColor || '#0f172a'}; font-size: 14px; font-weight: 700; letter-spacing: 0.02em;">${section.heading}</p>` : ''}
                ${section.body}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `)
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <title>${escapeHtml(title)}</title>
    </head>
    <body style="margin:0; padding:0; background-color:#eef2ff; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
      <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all; color:transparent;">${escapeHtml(preheader)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; background-color:#eef2ff; width:100%;">
        <tr>
          <td align="center" style="padding:32px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; border-collapse:separate; border-spacing:0;">
              <tr>
                <td style="padding:0 8px 16px 8px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate; border-spacing:0; background:#0f3a7a; border-radius:24px 24px 0 0;">
                    <tr>
                      <td align="center" style="padding:30px 24px 26px 24px;">
                        <p style="margin:0 0 6px 0; color:rgba(255,255,255,0.72); font-size:12px; letter-spacing:0.12em; text-transform:uppercase; font-weight:700;">${escapeHtml(eyebrow || PLATFORM_NAME)}</p>
                        <h1 style="margin:0; color:#ffffff; font-size:30px; line-height:1.2; font-weight:800; letter-spacing:-0.03em;">${escapeHtml(title)}</h1>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 8px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate; border-spacing:0; background:#ffffff; border-radius:0 0 24px 24px; box-shadow:0 18px 50px rgba(15, 23, 42, 0.12);">
                    <tr>
                      <td style="padding:36px 28px 28px 28px; font-family:Arial, Helvetica, sans-serif;">
                        <p style="margin:0 0 12px 0; color:#334155; font-size:17px; line-height:1.7;">${intro}</p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; margin-top:24px;">
                          <tbody>
                            ${sectionHtml}
                          </tbody>
                        </table>

                        ${ctaLabel && ctaUrl ? `
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:28px;">
                            <tr>
                              <td align="center">
                                <a href="${escapeHtml(ctaUrl)}" style="display:inline-block; background:#1d4ed8; color:#ffffff; text-decoration:none; font-size:15px; font-weight:700; padding:14px 24px; border-radius:999px; box-shadow:0 8px 18px rgba(29, 78, 216, 0.22);">${escapeHtml(ctaLabel)}</a>
                              </td>
                            </tr>
                          </table>
                        ` : ''}

                        <p style="margin:28px 0 0 0; color:#64748b; font-size:13px; line-height:1.7; text-align:center;">
                          ${escapeHtml(footerNote || `Need help? Contact ${SUPPORT_EMAIL}.`)}
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 28px 28px 28px; font-family:Arial, Helvetica, sans-serif;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; border-top:1px solid #e2e8f0;">
                          <tr>
                            <td style="padding-top:18px; color:#94a3b8; font-size:12px; line-height:1.7; text-align:center;">
                              ${PLATFORM_NAME} · <a href="${escapeHtml(PLATFORM_URL)}" style="color:#64748b; text-decoration:none;">${escapeHtml(PLATFORM_URL.replace(/^https?:\/\//, ''))}</a><br>
                              This is a transactional email related to your ${PLATFORM_NAME} account.
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function buildTextShell({ title, intro, sections = [], ctaLabel, ctaUrl, footerNote }) {
  const sectionText = sections
    .map((section) => {
      const heading = section.heading ? `${section.heading}\n` : '';
      const body = section.text || '';
      return `${heading}${body}`.trim();
    })
    .filter(Boolean)
    .join('\n\n');

  return [
    title,
    '',
    intro,
    '',
    sectionText,
    ctaLabel && ctaUrl ? `${ctaLabel}: ${ctaUrl}` : '',
    '',
    footerNote || `Need help? Contact ${SUPPORT_EMAIL}.`,
    '',
    PLATFORM_NAME,
    PLATFORM_URL,
    'This is a transactional email related to your SOCIO account.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Send a welcome email to new users
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {boolean} isOutsider - Whether the user is an external visitor
 * @param {string} visitorId - Visitor ID (for outsiders only)
 */
export async function sendWelcomeEmail(email, name, isOutsider = false, visitorId = null) {
  if (!resend) { console.warn('Resend not configured — skipping welcome email'); return { success: true }; }
  try {
    const firstName = getFirstName(name);
    const intro = `Your ${PLATFORM_NAME} account has been created. You can now browse events, register for activities, and manage your profile.`;
    const sections = isOutsider && visitorId
      ? [
          {
            heading: 'Account information',
            body: `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:0 0 8px 0; color:#64748b; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">Visitor ID</td>
                </tr>
                <tr>
                  <td style="color:#0f172a; font-size:18px; font-weight:700; letter-spacing:0.08em; font-family:Arial, Helvetica, sans-serif;">${escapeHtml(visitorId)}</td>
                </tr>
                <tr>
                  <td style="padding-top:10px; color:#334155; font-size:15px; line-height:1.7;">Keep this ID available when registering for events.</td>
                </tr>
              </table>
            `,
            text: `Visitor ID: ${visitorId}\nKeep this ID available when registering for events.`,
          },
          {
            heading: 'Recommended next step',
            background: '#f8fafc',
            border: '#dbe4f0',
            body: `
              <p style="margin:0; color:#334155; font-size:15px; line-height:1.7;">Visit your profile to set your display name. This can be changed once only.</p>
            `,
            text: 'Visit your profile to set your display name. This can be changed once only.',
          },
        ]
      : [
          {
            heading: 'What you can do now',
            body: `
              <ul style="margin:0; padding:0 0 0 18px; color:#334155; font-size:15px; line-height:1.8;">
                <li>Discover events across campus</li>
                <li>Register for activities from your account</li>
                <li>Receive updates and reminders</li>
              </ul>
            `,
            text: 'Discover events across campus. Register for activities from your account. Receive updates and reminders.',
          },
        ];

    const htmlContent = buildEmailShell({
      preheader: `Your ${PLATFORM_NAME} account is ready.`,
      eyebrow: PLATFORM_NAME,
      title: `Welcome, ${firstName}`,
      intro,
      sections,
      ctaLabel: 'View events',
      ctaUrl: `${PLATFORM_URL}/Discover`,
      footerNote: `If you need help, reply to this email or contact ${SUPPORT_EMAIL}.`,
    });

    const textContent = buildTextShell({
      title: `Welcome, ${firstName}`,
      intro,
      sections,
      ctaLabel: 'View events',
      ctaUrl: `${PLATFORM_URL}/Discover`,
      footerNote: `If you need help, reply to this email or contact ${SUPPORT_EMAIL}.`,
    });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: SUPPORT_EMAIL,
      to: [email],
      subject: `Welcome to SOCIO, ${firstName}`,
      html: htmlContent,
      text: textContent,
      headers: {
        'X-Entity-Ref-ID': `welcome-${Date.now()}`,
      },
    });

    if (error) {
      console.error('Error sending welcome email:', error);
      return { success: false, error };
    }

    console.log(`Welcome email sent to ${email}`);
    return { success: true, data };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send event registration confirmation email
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {object} event - Event details
 * @param {string} registrationId - Registration ID
 * @param {string|null} qrImageBase64 - Optional base64 data URL of QR code image
 */
export async function sendRegistrationEmail(email, name, event, registrationId, qrImageBase64 = null) {
  if (!resend) { console.warn('Resend not configured — skipping registration email'); return { success: true }; }
  try {
    const firstName = getFirstName(name);
    const eventTitle = escapeHtml(event?.title || 'your event');
    const eventDate = formatDate(event?.event_date);
    const eventTime = event?.event_time ? formatDate(`${event.event_date || ''} ${event.event_time}`, true) : null;
    const eventVenue = escapeHtml(event?.venue || 'To be announced');
    const ticketUrl = `${PLATFORM_URL}/profile`;

    let qrAttachments = [];
    let qrSectionText = `View your ticket: ${ticketUrl}`;
    let qrSectionBody = `
      <p style="margin:0; color:#334155; font-size:15px; line-height:1.7;">Open your profile to view your ticket and QR code before the event.</p>
      <div style="text-align:center; margin-top:18px;">
        <a href="${escapeHtml(ticketUrl)}" style="display:inline-block; background:#1d4ed8; color:#ffffff; text-decoration:none; padding:14px 24px; border-radius:999px; font-size:15px; font-weight:700;">View ticket</a>
      </div>
    `;

    if (qrImageBase64) {
      const base64Data = qrImageBase64.replace(/^data:image\/png;base64,/, '');
      qrAttachments = [{
        filename: 'entry-qr.png',
        content: Buffer.from(base64Data, 'base64'),
        content_id: 'entryqr',
        content_disposition: 'inline',
      }];
      qrSectionBody = `
        <p style="margin:0 0 16px 0; color:#334155; font-size:15px; line-height:1.7; text-align:center;">Show this QR code at the event entrance.</p>
        <div style="text-align:center; margin:0 0 16px 0;">
          <div style="display:inline-block; background:#ffffff; border:1px solid #dbe4f0; border-radius:18px; padding:14px; box-shadow:0 8px 24px rgba(15,23,42,0.06);">
            <img src="cid:entryqr" width="180" height="180" alt="Entry QR Code" style="display:block; border:0; outline:none; text-decoration:none;" />
          </div>
        </div>
        <div style="text-align:center;">
          <a href="${escapeHtml(ticketUrl)}" style="display:inline-block; color:#1d4ed8; font-size:13px; text-decoration:none; font-weight:700;">View full ticket on SOCIO</a>
        </div>
      `;
      qrSectionText = `Show this QR code at the event entrance. View full ticket: ${ticketUrl}`;
    }

    const intro = `Your registration for ${eventTitle} is confirmed. Keep this message for your records.`;

    const sections = [
      {
        heading: 'Registration details',
        body: `
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding:0 0 10px 0; color:#64748b; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; width:38%;">Event</td>
              <td style="padding:0 0 10px 0; color:#0f172a; font-size:15px; line-height:1.6;">${eventTitle}</td>
            </tr>
            <tr>
              <td style="padding:0 0 10px 0; color:#64748b; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">Date</td>
              <td style="padding:0 0 10px 0; color:#0f172a; font-size:15px; line-height:1.6;">${escapeHtml(eventDate)}</td>
            </tr>
            ${eventTime ? `
              <tr>
                <td style="padding:0 0 10px 0; color:#64748b; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">Time</td>
                <td style="padding:0 0 10px 0; color:#0f172a; font-size:15px; line-height:1.6;">${escapeHtml(eventTime)}</td>
              </tr>
            ` : ''}
            <tr>
              <td style="padding:0 0 10px 0; color:#64748b; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">Venue</td>
              <td style="padding:0 0 10px 0; color:#0f172a; font-size:15px; line-height:1.6;">${eventVenue}</td>
            </tr>
            <tr>
              <td style="padding:0; color:#64748b; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">Registration ID</td>
              <td style="padding:0; color:#1d4ed8; font-size:15px; line-height:1.6; font-family:Arial, Helvetica, sans-serif; font-weight:700;">${escapeHtml(registrationId)}</td>
            </tr>
          </table>
        `,
        text: `Event: ${event?.title || 'your event'}\nDate: ${event?.event_date || 'To be announced'}${event?.event_time ? `\nTime: ${event.event_time}` : ''}\nVenue: ${event?.venue || 'To be announced'}\nRegistration ID: ${registrationId}`,
      },
      {
        heading: 'Your ticket',
        background: '#f8fafc',
        body: qrSectionBody,
        text: qrSectionText,
      },
      {
        heading: 'Before the event',
        body: `
          <p style="margin:0; color:#334155; font-size:15px; line-height:1.7;">If event details change, the event page will be updated. Please check it closer to the date for the latest information.</p>
        `,
        text: 'If event details change, the event page will be updated. Please check it closer to the date for the latest information.',
      },
    ];
    
    const emailPayload = {
      from: FROM_EMAIL,
      replyTo: SUPPORT_EMAIL,
      to: [email],
      subject: `Registration confirmed for ${event?.title || 'your event'}`,
      html: buildEmailShell({
        preheader: `Your registration for ${event?.title || 'the event'} is confirmed.`,
        eyebrow: 'Registration confirmed',
        title: `Hello, ${firstName}`,
        intro,
        sections,
        ctaLabel: 'View event details',
        ctaUrl: `${PLATFORM_URL}/event/${event?.event_id || event?.id || ''}`.replace(/\/$/, ''),
        footerNote: `If anything looks incorrect, reply to this email or contact ${SUPPORT_EMAIL}.`,
      }),
      text: buildTextShell({
        title: `Hello, ${firstName}`,
        intro,
        sections,
        ctaLabel: 'View event details',
        ctaUrl: `${PLATFORM_URL}/event/${event?.event_id || event?.id || ''}`.replace(/\/$/, ''),
        footerNote: `If anything looks incorrect, reply to this email or contact ${SUPPORT_EMAIL}.`,
      }),
    };

    if (qrAttachments.length > 0) {
      emailPayload.attachments = qrAttachments;
    }

    const { data, error } = await resend.emails.send(emailPayload);

    if (error) {
      console.error('Error sending registration email:', error);
      return { success: false, error };
    }

    console.log(`Registration email sent to ${email}`);
    return { success: true, data };
  } catch (error) {
    console.error('Error sending registration email:', error);
    return { success: false, error: error.message };
  }
}

export default { sendWelcomeEmail, sendRegistrationEmail };
