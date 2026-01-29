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
      <div style="background: linear-gradient(135deg, #063168 0%, #154CB3 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: #e0e7ff; font-size: 14px; margin: 0 0 8px 0;">Your Visitor ID</p>
        <p style="color: #FFCC00; font-size: 28px; font-weight: bold; margin: 0; letter-spacing: 2px;">${visitorId}</p>
        <p style="color: #93c5fd; font-size: 12px; margin: 8px 0 0 0;">Keep this ID handy for event registrations</p>
      </div>
      <p style="color: #64748b; font-size: 14px; text-align: center; margin-bottom: 24px;">
        💡 <strong>Tip:</strong> Visit your profile to set your display name. You only get one chance to edit it!
      </p>
    ` : '';

    const memberSection = !isOutsider ? `
      <div style="background: #f0f9ff; border-left: 4px solid #154CB3; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <p style="color: #1e40af; font-weight: 600; margin: 0 0 8px 0;">🎓 Christ University Member</p>
        <p style="color: #475569; font-size: 14px; margin: 0;">
          You have full access to create events, manage registrations, and explore all features!
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
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #063168 0%, #154CB3 100%); border-radius: 16px 16px 0 0; padding: 40px 32px; text-align: center;">
          <h1 style="color: white; font-size: 32px; margin: 0; font-weight: bold;">
            Welcome to <span style="color: #FFCC00;">SOCIO</span>! 🎉
          </h1>
        </div>
        
        <!-- Body -->
        <div style="background: white; padding: 40px 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <h2 style="color: #1e293b; font-size: 24px; margin: 0 0 16px 0;">
            Hi ${firstName}! 👋
          </h2>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            We're thrilled to have you on board! SOCIO is your one-stop platform for discovering amazing events, 
            connecting with fellow enthusiasts, and making unforgettable memories.
          </p>
          
          ${outsiderSection}
          ${memberSection}
          
          <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="color: #854d0e; font-size: 14px; margin: 0; line-height: 1.6;">
              ✨ <strong>What's next?</strong><br>
              Explore upcoming events, register for the ones that excite you, and don't forget to check out 
              the latest happenings on campus!
            </p>
          </div>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="https://sociov2.vercel.app/Discover" 
               style="display: inline-block; background: linear-gradient(135deg, #154CB3 0%, #063168 100%); 
                      color: white; text-decoration: none; padding: 16px 40px; border-radius: 50px; 
                      font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(21, 76, 179, 0.4);">
              Explore Events 🚀
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
          
          <p style="color: #94a3b8; font-size: 14px; text-align: center; margin: 0;">
            Questions? Reply to this email or reach out at 
            <a href="mailto:support@withsocio.com" style="color: #154CB3; text-decoration: none;">support@withsocio.com</a>
          </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 24px; color: #94a3b8; font-size: 12px;">
          <p style="margin: 0 0 8px 0;">Made with ❤️ by the SOCIO Team</p>
          <p style="margin: 0;">
            <a href="https://sociov2.vercel.app" style="color: #154CB3; text-decoration: none;">sociov2.vercel.app</a>
            &nbsp;•&nbsp;
            <a href="https://withsocio.com" style="color: #154CB3; text-decoration: none;">withsocio.com</a>
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'SOCIO <onboarding@resend.dev>',
      to: [email],
      subject: `Welcome to SOCIO, ${firstName}! 🎉`,
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
