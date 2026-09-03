// Turns a raw error (Supabase/Postgres error, Auth error, thrown Error, or
// unknown value) into a short message a non-technical user can act on.
// Raw database/driver messages ("duplicate key value violates unique
// constraint \"items_sku_key\"") are replaced with plain-language text;
// messages we don't recognize fall back to a generic, still-actionable line
// instead of leaking internals to the UI.

type ErrorLike = {
  message?: unknown
  code?: unknown
}

const DEFAULT_FALLBACK = 'Something went wrong. Please try again.'

const POSTGRES_CODE_MESSAGES: Record<string, string> = {
  '23505': 'That record already exists. Please check for duplicates.',
  '23503': "This record is linked to other data and can't be changed or deleted.",
  '23502': 'Please fill in all required fields.',
  '23514': "One of the values entered isn't valid. Please check your entries.",
  '22001': 'One of the values entered is too long.',
  '22P02': "One of the values entered isn't in the right format.",
  '42501': "You don't have permission to do that.",
  PGRST116: 'That record could not be found.',
  PGRST301: 'Your session has expired. Please sign in again.',
}

const MESSAGE_OVERRIDES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'Incorrect email or password.'],
  [/email not confirmed/i, 'Please confirm your email address before signing in.'],
  [/user already registered|already been registered/i, 'An account with this email already exists.'],
  [/jwt expired|token is expired/i, 'Your session has expired. Please sign in again.'],
  [/network ?error|failed to fetch/i, "Can't reach the server. Please check your connection and try again."],
]

// Messages that are technical/internal and should never reach a user as-is —
// shown instead as DEFAULT_FALLBACK (or the caller's fallback).
const RAW_TECHNICAL_PATTERNS: RegExp[] = [
  /violates .* constraint/i,
  /duplicate key value/i,
  /row-level security/i,
  /null value in column/i,
  /invalid input syntax/i,
  /relation ".*" does not exist/i,
  /column ".*" does not exist/i,
  /permission denied for/i,
  /unexpected token/i,
  /^\{.*\}$/, // stray JSON blob
]

export function getErrorMessage(error: unknown, fallback: string = DEFAULT_FALLBACK): string {
  if (!error) return fallback

  if (typeof error === 'string') {
    return error.trim() ? formatMessage(error, fallback) : fallback
  }

  const err = error as ErrorLike
  const code = typeof err?.code === 'string' ? err.code : undefined
  if (code && POSTGRES_CODE_MESSAGES[code]) return POSTGRES_CODE_MESSAGES[code]

  const message = typeof err?.message === 'string'
    ? err.message
    : error instanceof Error
      ? error.message
      : ''

  if (!message.trim()) return fallback

  return formatMessage(message, fallback)
}

function formatMessage(message: string, fallback: string): string {
  for (const [pattern, friendly] of MESSAGE_OVERRIDES) {
    if (pattern.test(message)) return friendly
  }
  if (RAW_TECHNICAL_PATTERNS.some(p => p.test(message))) return fallback
  return message
}
