import rateLimit from "express-rate-limit";

const violationState = new Map();

const parseEnvInt = (name, fallback) => {
  const raw = process.env[name];
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseTrustedIps = () => {
  return (process.env.RATE_LIMIT_TRUSTED_IPS || "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
};

const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
};

const extractUserHint = (req) => {
  const authUser = req.user;
  if (authUser?.email) return String(authUser.email).trim().toLowerCase();
  if (authUser?.id) return String(authUser.id).trim().toLowerCase();

  const headerUserEmail = req.headers["x-user-email"];
  if (typeof headerUserEmail === "string" && headerUserEmail.trim()) {
    return headerUserEmail.trim().toLowerCase();
  }

  const body = req.body || {};
  const fallbackCandidates = [
    body?.email,
    body?.user_email,
    body?.individual_email,
    body?.team_leader_email,
    body?.user?.email,
    body?.message?.email,
  ];

  for (const candidate of fallbackCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().toLowerCase();
    }
  }

  return "anon";
};

const buildIdentityKey = (req) => {
  const ip = getClientIp(req);
  const userHint = extractUserHint(req);
  return `${ip}:${userHint}`;
};

const isTrustedRequest = (req) => {
  const trustedIps = parseTrustedIps();
  if (trustedIps.length === 0) return false;
  const ip = getClientIp(req);
  return trustedIps.includes(ip);
};

const recordViolation = (key) => {
  const now = Date.now();
  const current = violationState.get(key);

  if (!current || now - current.lastViolationAt > 10 * 60 * 1000) {
    violationState.set(key, { count: 1, lastViolationAt: now });
    return;
  }

  violationState.set(key, {
    count: current.count + 1,
    lastViolationAt: now,
  });
};

const getDelayMs = (key) => {
  const state = violationState.get(key);
  if (!state) return 0;
  const delayPerViolationMs = parseEnvInt("RATE_LIMIT_PROGRESSIVE_DELAY_MS", 250);
  const maxDelayMs = parseEnvInt("RATE_LIMIT_MAX_DELAY_MS", 3000);
  return Math.min((state.count - 1) * delayPerViolationMs, maxDelayMs);
};

setInterval(() => {
  const now = Date.now();
  for (const [key, state] of violationState.entries()) {
    if (now - state.lastViolationAt > 30 * 60 * 1000) {
      violationState.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

const createRateLimiter = ({
  name,
  windowEnv,
  maxEnv,
  defaultWindowSeconds,
  defaultMax,
}) => {
  const windowSeconds = parseEnvInt(windowEnv, defaultWindowSeconds);
  const max = parseEnvInt(maxEnv, defaultMax);
  const windowMs = windowSeconds * 1000;

  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isTrustedRequest(req),
    keyGenerator: buildIdentityKey,
    handler: (req, res) => {
      const key = buildIdentityKey(req);
      recordViolation(key);

      const resetTime = req.rateLimit?.resetTime
        ? new Date(req.rateLimit.resetTime).getTime()
        : Date.now() + windowMs;
      const retryAfter = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));

      res.set("Retry-After", String(retryAfter));
      res.status(429).json({
        success: false,
        error: "Too many requests. Please try again later.",
        retryAfter,
      });
    },
    requestPropertyName: `${name}RateLimit`,
  });
};

export const withProgressiveDelay = (req, res, next) => {
  if (isTrustedRequest(req)) return next();

  const key = buildIdentityKey(req);
  const delayMs = getDelayMs(key);
  if (delayMs <= 0) return next();

  setTimeout(next, delayMs);
};

export const authLimiter = createRateLimiter({
  name: "auth",
  windowEnv: "RATE_LIMIT_AUTH_WINDOW",
  maxEnv: "RATE_LIMIT_AUTH_MAX",
  defaultWindowSeconds: 60,
  defaultMax: 8,
});

export const bruteForceLimiter = createRateLimiter({
  name: "bruteforce",
  windowEnv: "RATE_LIMIT_BRUTE_WINDOW",
  maxEnv: "RATE_LIMIT_BRUTE_MAX",
  defaultWindowSeconds: 60,
  defaultMax: 5,
});

export const registrationLimiter = createRateLimiter({
  name: "registration",
  windowEnv: "RATE_LIMIT_REGISTRATION_WINDOW",
  maxEnv: "RATE_LIMIT_REGISTRATION_MAX",
  defaultWindowSeconds: 60,
  defaultMax: 10,
});

export const chatLimiter = createRateLimiter({
  name: "chat",
  windowEnv: "RATE_LIMIT_CHAT_WINDOW",
  maxEnv: "RATE_LIMIT_CHAT_MAX",
  defaultWindowSeconds: 60,
  defaultMax: 25,
});

export const contactLimiter = createRateLimiter({
  name: "contact",
  windowEnv: "RATE_LIMIT_CONTACT_WINDOW",
  maxEnv: "RATE_LIMIT_CONTACT_MAX",
  defaultWindowSeconds: 60,
  defaultMax: 5,
});

export const userReadLimiter = createRateLimiter({
  name: "userread",
  windowEnv: "RATE_LIMIT_USER_WINDOW",
  maxEnv: "RATE_LIMIT_USER_MAX",
  defaultWindowSeconds: 60,
  defaultMax: 120,
});

export const supportActionLimiter = createRateLimiter({
  name: "support",
  windowEnv: "RATE_LIMIT_SUPPORT_WINDOW",
  maxEnv: "RATE_LIMIT_SUPPORT_MAX",
  defaultWindowSeconds: 60,
  defaultMax: 30,
});