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
    return res.status(400).send("No auth code provided. This route expects an OAuth code from Google/Supabase.");
  }

  try {
    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(String(code));

    if (error) throw error;

    const { session } = data;
    if (!session) throw new Error("No session returned");

    // For Web/PWA, redirect back to the app's callback page with tokens.
    // This allows the client-side to call setSession() without needing its own PKCE verifier
    // (since the server already handled the exchange).
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.withsocio.com";
    const webRedirectUrl = `${appUrl}/auth/callback?token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}&next=${encodeURIComponent(String(next))}`;
    
    console.log(`[Auth] Web login success. Redirecting to: ${webRedirectUrl.substring(0, 50)}...`);
    
    return res.redirect(webRedirectUrl);
  } catch (err) {
    console.error("[Auth] Callback error:", err.message);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.withsocio.com";
    return res.redirect(`${appUrl}/auth?error=${encodeURIComponent(err.message)}`);
  }
});

export default router;
