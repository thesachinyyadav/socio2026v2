import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/auth/callback
 * Handlers the OAuth callback from Supabase/Google.
 * Exchanges the code for a session and redirects to the Capacitor deep link.
 */
router.get("/callback", async (req, res) => {
  const code = req.query.code;
  const next = req.query.next || "/";

  if (!code) {
    return res.status(400).send("No auth code provided");
  }

  try {
    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(String(code));

    if (error) throw error;

    const { session } = data;
    if (!session) throw new Error("No session returned");

    // Redirect to the Capacitor deep link
    // Scheme: socio://auth/callback
    const deepLinkUrl = `socio://auth/callback?token=${session.access_token}&refresh_token=${session.refresh_token}&next=${next}`;
    
    console.log(`[Auth] Redirecting to deep link: ${deepLinkUrl.substring(0, 50)}...`);
    
    return res.redirect(deepLinkUrl);
  } catch (err) {
    console.error("[Auth] Callback error:", err.message);
    // Fallback to a web error page or redirect back to app with error
    return res.redirect(`socio://auth/callback?error=${encodeURIComponent(err.message)}`);
  }
});

export default router;
