import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const appUrl =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.FRONTEND_URL ||
  "https://sociodev.vercel.app";

if (!process.env.APP_URL && !process.env.NEXT_PUBLIC_APP_URL && !process.env.FRONTEND_URL) {
  console.warn('APP_URL/NEXT_PUBLIC_APP_URL not set. Falling back to https://sociodev.vercel.app for email links.');
}

const appOrigin = appUrl.replace(/\/$/, '');
const appLink = (pathname) => new URL(pathname, `${appOrigin}/`).toString();

/**
 * Send a welcome email to new users
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {boolean} isOutsider - Whether the user is an external visitor
 * @param {string} visitorId - Visitor ID (for outsiders only)
 */
export async function sendWelcomeEmail(email, name, isOutsider = false, visitorId = null) {
  if (!resend) { console.warn('⚠️ Resend not configured — skipping welcome email'); return { success: true }; }
  try {
    const firstName = name ? name.split(' ')[0] : 'there';
    
    const outsiderSection = isOutsider && visitorId ? `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Your Visitor ID</p>
        <p style="color: #063168; font-size: 28px; font-weight: 700; margin: 0; letter-spacing: 2px; font-family: 'Courier New', monospace;">${visitorId}</p>
        <p style="color: #94a3b8; font-size: 13px; margin: 12px 0 0 0;">Keep this safe — you'll need it for event registrations.</p>
      </div>
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px 20px; margin-bottom: 24px;">
        <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
          <strong>Tip:</strong> Visit your profile to set your display name. This can only be done once.
        </p>
      </div>
    ` : '';

    const memberSection = !isOutsider ? `
      <div style="background: #f0f9ff; border-left: 4px solid #154CB3; padding: 20px; margin: 24px 0;">
        <p style="color: #1e40af; font-weight: 600; font-size: 15px; margin: 0 0 8px 0;">You're all set! 🎉</p>
        <p style="color: #475569; font-size: 14px; margin: 0; line-height: 1.6;">
          Discover events, register instantly, and get updates directly — no middlemen, no hassle.
        </p>
      </div>
    ` : '';

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #063168 0%, #154CB3 100%); border-radius: 16px 16px 0 0; padding: 40px 32px; text-align: center;">
          <h1 style="color: white; font-size: 42px; font-weight: 700; margin: 0 0 8px 0; letter-spacing: -1px;">SOCIO</h1>
          <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 0; font-weight: 400;">
            Campus Events Platform
          </p>
        </div>
        
        <!-- Body -->
        <div style="background: white; padding: 40px 36px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);">
          
          <h2 style="color: #1e293b; font-size: 24px; margin: 0 0 8px 0; font-weight: 600;">
            Welcome, ${firstName}
          </h2>
          <p style="color: #64748b; font-size: 15px; margin: 0 0 24px 0;">
            Thank you for joining SOCIO <span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">BETA</span>
          </p>
          
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">
            SOCIO is your gateway to campus events, club activities, and community experiences. 
            Whether you're looking to discover events or organize your own, we're here to help you connect.
          </p>
          
          ${outsiderSection}
          ${memberSection}
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${appLink('/Discover')}" 
               style="display: inline-block; background: #154CB3; 
                      color: white; text-decoration: none; padding: 14px 36px; border-radius: 8px; 
                      font-weight: 600; font-size: 15px;">
              Browse Events
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
          
          <p style="color: #94a3b8; font-size: 13px; margin: 0; text-align: center; line-height: 1.6;">
            Need help? <a href="${appLink('/support')}" style="color: #154CB3; text-decoration: none;">Contact our support</a>
          </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 24px; color: #94a3b8; font-size: 12px;">
          <p style="margin: 0 0 8px 0;">
            SOCIO Team
          </p>
          <p style="margin: 0;">
            <a href="${appLink('/')}" style="color: #64748b; text-decoration: none;">${appOrigin}</a>
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    // Plain text version for better deliverability
    const textContent = `
Welcome, ${firstName}

Thank you for joining SOCIO (Beta).

SOCIO is your gateway to campus events, club activities, and community experiences. Whether you're looking to discover events or organize your own, we're here to help you connect.

${isOutsider && visitorId ? `Your Visitor ID: ${visitorId}\nKeep this safe — you'll need it for event registrations.\n\nTip: Visit your profile to set your display name. This can only be done once.` : `You're all set! Discover events, register instantly, and get updates directly — no middlemen, no hassle.`}

Browse events: ${appLink('/Discover')}

Need help? Contact our support: ${appLink('/support')}

SOCIO Team
${appOrigin}
    `.trim();

    const { data, error } = await resend.emails.send({
      from: 'SOCIO <hello@withsocio.com>',
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
  if (!resend) { console.warn('⚠️ Resend not configured — skipping registration email'); return { success: true }; }
  try {
    const firstName = name ? name.split(' ')[0] : 'there';
    const ticketUrl = appLink('/profile');

    // Build inline QR attachment if image provided
    let qrAttachments = [];
    let qrHtmlBlock = `
      <div style="text-align: center; margin: 24px 0;">
        <a href="${ticketUrl}" style="display: inline-block; background: #154CB3; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
          View My Ticket &amp; QR Code
        </a>
      </div>
    `;

    if (qrImageBase64) {
      // Strip the data URL prefix to get raw base64
      const base64Data = qrImageBase64.replace(/^data:image\/png;base64,/, '');
      qrAttachments = [{
        filename: 'entry-qr.png',
        content: Buffer.from(base64Data, 'base64'),
        content_id: 'entryqr',
        content_disposition: 'inline',
      }];
      qrHtmlBlock = `
        <div style="text-align: center; margin: 28px 0;">
          <p style="color: #475569; font-size: 14px; margin: 0 0 16px 0; font-weight: 600;">Your Entry QR Code</p>
          <div style="display: inline-block; background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 12px;">
            <img src="cid:entryqr" width="180" height="180" alt="Entry QR Code" style="display: block;" />
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 12px 0 0 0;">Show this QR code at the event entrance</p>
          <div style="margin-top: 16px;">
            <a href="${ticketUrl}" style="color: #154CB3; font-size: 13px; text-decoration: none; font-weight: 500;">
              View full ticket on SOCIO →
            </a>
          </div>
        </div>
      `;
    }

    const emailPayload = {
      from: 'SOCIO <hello@withsocio.com>',
      to: [email],
      subject: `Your Ticket - ${event.title}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: linear-gradient(135deg, #063168 0%, #154CB3 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
              <img src="${appLink('/images/withsocio.png')}" alt="SOCIO" width="140" height="auto" style="display: block; margin: 0 auto; max-width: 140px;">
            </div>
            <div style="background: white; padding: 40px 36px; border-radius: 0 0 16px 16px;">
              <h2 style="color: #1e293b; font-size: 22px; margin: 0 0 8px 0;">Registration Confirmed</h2>
              <p style="color: #64748b; font-size: 15px; margin: 0 0 24px 0;">Hi ${firstName}, you're registered!</p>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 0 0 24px 0;">
                <p style="margin: 0 0 12px 0;"><strong style="color: #475569;">Event:</strong> <span style="color: #1e293b;">${event.title}</span></p>
                <p style="margin: 0 0 12px 0;"><strong style="color: #475569;">Date:</strong> <span style="color: #1e293b;">${event.event_date || 'To be announced'}</span></p>
                <p style="margin: 0 0 12px 0;"><strong style="color: #475569;">Venue:</strong> <span style="color: #1e293b;">${event.venue || 'To be announced'}</span></p>
                <p style="margin: 0;"><strong style="color: #475569;">Registration ID:</strong> <span style="color: #063168; font-family: monospace; font-weight: 600; font-size: 13px;">${registrationId}</span></p>
              </div>

              ${qrHtmlBlock}

              <!-- Beta Notice -->
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 1px solid #f59e0b; border-radius: 10px; padding: 20px; margin: 24px 0 0 0;">
                <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.6; text-align: center;">
                  <strong style="display: block; margin-bottom: 8px;">Beta Preview</strong>
                  This is a preview version of SOCIO. We sincerely apologize for any inconvenience caused due to technical glitches. We're working hard to improve your experience every day.
                </p>
                <p style="color: #b45309; font-size: 12px; margin: 12px 0 0 0; text-align: center; font-style: italic;">
                  Thank you for your patience and support!<br>
                  — With love, Team SOCIO
                </p>
              </div>
            </div>
            <div style="text-align: center; padding: 24px; color: #94a3b8; font-size: 12px;">
              <p style="margin: 0;">SOCIO Team | <a href="${appLink('/')}" style="color: #64748b; text-decoration: none;">${appOrigin}</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Registration Confirmed\n\nHi ${firstName}, you're registered for ${event.title}.\n\nEvent: ${event.title}\nDate: ${event.event_date || 'To be announced'}\nVenue: ${event.venue || 'To be announced'}\nRegistration ID: ${registrationId}\n\nView your ticket: ${ticketUrl}\n\nSOCIO Team\n${appOrigin}`,
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
