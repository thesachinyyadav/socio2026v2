const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

const ERROR_RULES = [
  {
    pattern: /(no valid authorization token|invalid or expired token|token validation|authentication required|user not authenticated|session)/i,
    message: 'Please sign in again.',
  },
  {
    pattern: /(permission|unauthorized|forbidden|access denied|privileges required|not authorized)/i,
    message: 'You do not have permission to perform this action.',
  },
  {
    pattern: /(not found|does not exist|already deleted|missing)/i,
    message: 'Item not found - it may have been removed.',
  },
  {
    pattern: /(file too large|size must be less than|max size|payload too large)/i,
    message: 'The file is too large. Please choose a smaller file.',
  },
  {
    pattern: /(invalid file type|unsupported file type|not supported)/i,
    message: 'That file type is not supported. Please choose another file.',
  },
  {
    pattern: /(network|fetch failed|timeout|econnrefused|ehostunreach|enetunreach)/i,
    message: 'No internet connection. Please try again.',
  },
  {
    pattern: /(already exists|duplicate|conflict|already assigned|already submitted|already sent|already used|already updated)/i,
    message: 'This item already exists or has already been updated.',
  },
  {
    pattern: /(required|must be|invalid|empty string|missing)/i,
    message: 'Please check your input and try again.',
  },
];

const STATUS_MESSAGES = {
  400: 'Please check your input and try again.',
  401: 'Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'Item not found - it may have been removed.',
  409: 'This item already exists or has already been updated.',
  413: 'The file is too large. Please choose a smaller file.',
  429: 'Too many requests. Please wait and try again.',
  500: DEFAULT_ERROR_MESSAGE,
};

function extractErrorText(error) {
  if (typeof error === 'string') return error;
  if (!error) return '';
  if (typeof error.message === 'string' && error.message.trim()) return error.message.trim();
  if (typeof error.error === 'string' && error.error.trim()) return error.error.trim();
  if (typeof error.details === 'string' && error.details.trim()) return error.details.trim();
  return '';
}

export function getFriendlyErrorMessage(error, fallback = DEFAULT_ERROR_MESSAGE) {
  const rawMessage = extractErrorText(error);
  if (!rawMessage) {
    return fallback;
  }

  for (const rule of ERROR_RULES) {
    if (rule.pattern.test(rawMessage)) {
      return rule.message;
    }
  }

  return fallback;
}

export function getStatusFriendlyMessage(statusCode, fallback = DEFAULT_ERROR_MESSAGE) {
  return STATUS_MESSAGES[statusCode] || fallback;
}

export function sanitizeErrorPayload(payload, statusCode) {
  const safeMessage = getFriendlyErrorMessage(payload, getStatusFriendlyMessage(statusCode));

  return {
    error: safeMessage,
    status: statusCode,
  };
}
