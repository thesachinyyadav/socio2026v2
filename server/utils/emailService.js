import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a welcome email to new users
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {boolean} isOutsider - Whether the user is an external visitor
 * @param {string} visitorId - Visitor ID (for outsiders only)
 */
export async function sendWelcomeEmail(email, name, isOutsider = false, visitorId = null) {
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
        <p style="color: #1e40af; font-weight: 600; font-size: 15px; margin: 0 0 8px 0;">Christ University Member</p>
        <p style="color: #475569; font-size: 14px; margin: 0; line-height: 1.6;">
          As a verified member, you have full access to create events, manage clubs, and engage with the campus community.
        </p>
      </div>
    ` : '';

    // Use hosted logo image (PNG works in all email clients)
    // Note: You should upload a proper SOCIO logo to your hosting
    const logoUrl = 'https://sociov2.vercel.app/images/withsocio.png';

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
          <img src="${logoUrl}" alt="SOCIO" width="160" height="auto" style="display: block; margin: 0 auto 16px auto; max-width: 160px;">
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
            Thank you for joining SOCIO.
          </p>
          
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">
            SOCIO is your gateway to campus events, club activities, and community experiences. 
            Whether you're looking to discover events or organize your own, we're here to help you connect.
          </p>
          
          ${outsiderSection}
          ${memberSection}
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="https://sociov2.vercel.app/Discover" 
               style="display: inline-block; background: #154CB3; 
                      color: white; text-decoration: none; padding: 14px 36px; border-radius: 8px; 
                      font-weight: 600; font-size: 15px;">
              Browse Events
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
          
          <p style="color: #94a3b8; font-size: 13px; margin: 0; text-align: center; line-height: 1.6;">
            Need help? Contact us at 
            <a href="mailto:support@withsocio.com" style="color: #154CB3; text-decoration: none;">support@withsocio.com</a>
          </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 24px; color: #94a3b8; font-size: 12px;">
          <p style="margin: 0 0 8px 0;">
            SOCIO Team
          </p>
          <p style="margin: 0;">
            <a href="https://sociov2.vercel.app" style="color: #64748b; text-decoration: none;">sociov2.vercel.app</a>
            <span style="margin: 0 8px; color: #cbd5e1;">|</span>
            <a href="https://withsocio.com" style="color: #64748b; text-decoration: none;">withsocio.com</a>
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    // Plain text version for better deliverability
    const textContent = `
Welcome, ${firstName}

Thank you for joining SOCIO.

SOCIO is your gateway to campus events, club activities, and community experiences. Whether you're looking to discover events or organize your own, we're here to help you connect.

${isOutsider && visitorId ? `Your Visitor ID: ${visitorId}\nKeep this safe — you'll need it for event registrations.\n\nTip: Visit your profile to set your display name. This can only be done once.` : `As a verified Christ University member, you have full access to create events, manage clubs, and engage with the campus community.`}

Browse events: https://sociov2.vercel.app/Discover

Need help? Contact us at support@withsocio.com

SOCIO Team
https://sociov2.vercel.app
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
 */
export async function sendRegistrationEmail(email, name, event, registrationId) {
  try {
    const firstName = name ? name.split(' ')[0] : 'there';
    
    const { data, error } = await resend.emails.send({
      from: 'SOCIO <hello@withsocio.com>',
      to: [email],
      subject: `Registration Confirmed - ${event.title}`,
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
              <img src="https://sociov2.vercel.app/images/withsocio.png" alt="SOCIO" width="140" height="auto" style="display: block; margin: 0 auto; max-width: 140px;">
            </div>
            <div style="background: white; padding: 40px 36px; border-radius: 0 0 16px 16px;">
              <h2 style="color: #1e293b; font-size: 22px; margin: 0 0 8px 0;">Registration Confirmed</h2>
              <p style="color: #64748b; font-size: 15px; margin: 0 0 24px 0;">Hi ${firstName}, you're all set.</p>
              
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <p style="margin: 0 0 12px 0;"><strong style="color: #475569;">Event:</strong> <span style="color: #1e293b;">${event.title}</span></p>
                <p style="margin: 0 0 12px 0;"><strong style="color: #475569;">Date:</strong> <span style="color: #1e293b;">${event.event_date || 'To be announced'}</span></p>
                <p style="margin: 0 0 12px 0;"><strong style="color: #475569;">Venue:</strong> <span style="color: #1e293b;">${event.venue || 'To be announced'}</span></p>
                <p style="margin: 0;"><strong style="color: #475569;">Registration ID:</strong> <span style="color: #063168; font-family: monospace; font-weight: 600;">${registrationId}</span></p>
              </div>
              
              <p style="color: #64748b; font-size: 14px; margin: 24px 0 0 0; text-align: center;">
                See you there.
              </p>
            </div>
            <div style="text-align: center; padding: 24px; color: #94a3b8; font-size: 12px;">
              <p style="margin: 0;">SOCIO Team | <a href="https://sociov2.vercel.app" style="color: #64748b; text-decoration: none;">sociov2.vercel.app</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Registration Confirmed\n\nHi ${firstName}, you're all set for ${event.title}.\n\nEvent: ${event.title}\nDate: ${event.event_date || 'To be announced'}\nVenue: ${event.venue || 'To be announced'}\nRegistration ID: ${registrationId}\n\nSee you there.\n\nSOCIO Team\nhttps://sociov2.vercel.app`,
    });

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
