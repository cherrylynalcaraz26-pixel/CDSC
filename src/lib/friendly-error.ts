/** Turns a raw error (a browser exception, a fetch failure, or a Postgres/Supabase
 *  error message) into plain language a non-technical staff member can act on,
 *  instead of surfacing text like "The string did not match the expected pattern"
 *  or "duplicate key value violates unique constraint \"items_item_code_key\"". */
export function friendlyErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const msg = raw.toLowerCase()

  if (!msg) return fallback

  if (msg.includes('did not match the expected pattern') || msg.includes('invalid url') || msg.includes("failed to construct 'url'")) {
    return 'One of the fields has an invalid format (often a link or image). Please check what you entered and try again.'
  }
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed') || msg.includes('network request failed')) {
    return "Couldn't connect to the server. Check your internet connection and try again."
  }
  if (msg.includes('duplicate key value violates unique constraint') || msg.includes('already exists')) {
    return 'That code or name is already in use. Please use a different one.'
  }
  if (msg.includes('violates foreign key constraint')) {
    return "This record is linked to other data and can't be changed that way. Please check related records first."
  }
  if (msg.includes('violates not-null constraint') || msg.includes('violates check constraint')) {
    return 'Please fill in all required fields before saving.'
  }
  if (msg.includes('permission denied') || msg.includes('row-level security') || msg.includes('rls')) {
    return "You don't have permission to do that. Please contact an administrator."
  }
  if (msg.includes('jwt') || msg.includes('session') && msg.includes('expired')) {
    return 'Your session has expired. Please log in again.'
  }

  // Fall back to the raw message rather than hiding it entirely — still useful for
  // an unexpected case, just not left unexplained.
  return raw || fallback
}
