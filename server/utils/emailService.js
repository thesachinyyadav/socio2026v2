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
      <div style="background: linear-gradient(135deg, #063168 0%, #154CB3 100%); border-radius: 16px; padding: 28px; margin: 28px 0; text-align: center;">
        <p style="color: #e0e7ff; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your Visitor ID</p>
        <p style="color: #FFCC00; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 3px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${visitorId}</p>
        <p style="color: #93c5fd; font-size: 12px; margin: 12px 0 0 0;">Save this — you'll need it for event registrations ✨</p>
      </div>
      <div style="background: #fef3c7; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: flex-start;">
        <span style="font-size: 20px; margin-right: 12px;">💡</span>
        <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
          <strong>Quick tip:</strong> Head to your profile to personalize your display name. You only get one shot at this, so make it count!
        </p>
      </div>
    ` : '';

    const memberSection = !isOutsider ? `
      <div style="background: linear-gradient(135deg, #dbeafe 0%, #ede9fe 100%); border-radius: 16px; padding: 24px; margin: 28px 0;">
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 24px; margin-right: 12px;">🎓</span>
          <p style="color: #1e40af; font-weight: 700; font-size: 16px; margin: 0;">You're part of the Christ University family!</p>
        </div>
        <p style="color: #475569; font-size: 14px; margin: 0; line-height: 1.6;">
          As a member, you have full access to create events, build your community, and be part of something amazing. The stage is yours!
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
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f4f8; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #063168 0%, #154CB3 50%, #1e3a5f 100%); border-radius: 20px 20px 0 0; padding: 50px 32px; text-align: center;">
          <div style="margin-bottom: 20px;">
            <span style="font-size: 48px;">🎊</span>
          </div>
          <h1 style="color: white; font-size: 28px; margin: 0 0 8px 0; font-weight: 300;">
            Welcome aboard
          </h1>
          <h2 style="color: #FFCC00; font-size: 42px; margin: 0; font-weight: 800; letter-spacing: -1px;">
            SOCIO
          </h2>
        </div>
        
        <!-- Body -->
        <div style="background: white; padding: 44px 36px; border-radius: 0 0 20px 20px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);">
          
          <h2 style="color: #1e293b; font-size: 26px; margin: 0 0 8px 0; font-weight: 600;">
            Hey ${firstName}! 
          </h2>
          <p style="color: #64748b; font-size: 15px; margin: 0 0 28px 0;">
            So glad you're here. Seriously.
          </p>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 8px 0;">
            You just joined a community where <strong style="color: #154CB3;">ideas come to life</strong>, 
            where events aren't just events — they're experiences, memories, and connections waiting to happen.
          </p>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 28px 0;">
            Whether you're here to discover something new, meet like-minded people, or create moments that matter — 
            <strong style="color: #1e293b;">you're in the right place.</strong>
          </p>
          
          ${outsiderSection}
          ${memberSection}
          
          <div style="background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%); border-radius: 16px; padding: 24px; margin: 28px 0; text-align: center;">
            <p style="color: #854d0e; font-size: 18px; font-weight: 600; margin: 0 0 8px 0;">
              Ready to dive in? 🏊‍♂️
            </p>
            <p style="color: #a16207; font-size: 14px; margin: 0; line-height: 1.5;">
              Browse upcoming events, find your vibe, and let the adventure begin.
            </p>
          </div>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 36px 0;">
            <a href="https://sociov2.vercel.app/Discover" 
               style="display: inline-block; background: linear-gradient(135deg, #154CB3 0%, #063168 100%); 
                      color: white; text-decoration: none; padding: 18px 48px; border-radius: 50px; 
                      font-weight: 600; font-size: 16px; box-shadow: 0 8px 24px rgba(21, 76, 179, 0.35);
                      transition: transform 0.2s;">
              Explore Events →
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 36px 0;">
          
          <div style="text-align: center;">
            <p style="color: #94a3b8; font-size: 14px; margin: 0 0 8px 0;">
              Questions? We're always here for you.
            </p>
            <a href="mailto:support@withsocio.com" style="color: #154CB3; text-decoration: none; font-weight: 500;">
              support@withsocio.com
            </a>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 28px; color: #94a3b8; font-size: 12px;">
          <p style="margin: 0 0 12px 0;">
            Made with 💙 by the SOCIO Team
          </p>
          <p style="margin: 0;">
            <a href="https://sociov2.vercel.app" style="color: #64748b; text-decoration: none;">sociov2.vercel.app</a>
            <span style="margin: 0 8px; color: #cbd5e1;">•</span>
            <a href="https://withsocio.com" style="color: #64748b; text-decoration: none;">withsocio.com</a>
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'SOCIO <hello@withsocio.com>',
      to: [email],
      subject: `${firstName}, welcome to SOCIO! 🎉`,
      html: htmlContent,
    });

    if (error) {
      console.error('Error sending welcome email:', error);
      return { success: false, error };
    }

    console.log(`✉️ Welcome email sent to ${email}`);
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
      from: 'SOCIO <onboarding@resend.dev>',
      to: [email],
      subject: `You're registered for ${event.title}! 🎟️`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #154CB3;">Registration Confirmed! 🎉</h1>
          <p>Hi ${firstName},</p>
          <p>You're all set for <strong>${event.title}</strong>!</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Event:</strong> ${event.title}</p>
            <p><strong>Date:</strong> ${event.event_date || 'TBA'}</p>
            <p><strong>Venue:</strong> ${event.venue || 'TBA'}</p>
            <p><strong>Registration ID:</strong> ${registrationId}</p>
          </div>
          <p>See you there!</p>
          <p>- The SOCIO Team</p>
        </div>
      `,
    });

    if (error) {
      console.error('Error sending registration email:', error);
      return { success: false, error };
    }

    console.log(`✉️ Registration email sent to ${email}`);
    return { success: true, data };
  } catch (error) {
    console.error('Error sending registration email:', error);
    return { success: false, error: error.message };
  }
}

export default { sendWelcomeEmail, sendRegistrationEmail };
