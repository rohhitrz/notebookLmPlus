export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

// Errors whose message is written by us and safe to show a user verbatim.
export class PublicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicError";
  }
}

// Error text we author ourselves and is useful to surface — chiefly missing
// server configuration, which is otherwise invisible in production.
const SAFE_PATTERNS = [
  /is not set$/,
  /^No web sources found/,
  /^Only http and https/,
  /points to a private or reserved address/,
  /^Could not resolve that hostname/,
  /too large to import/,
  /redirected too many times/,
];

/**
 * Converts an unknown thrown value into a message safe to send to the client.
 * Third-party errors (OpenAI SDK, Postgres, fetch) can embed request details or
 * configuration, so anything not explicitly recognized becomes a generic string.
 */
export function toPublicMessage(err: unknown, fallback: string): string {
  if (err instanceof PublicError) return err.message;
  if (err instanceof Error && SAFE_PATTERNS.some((p) => p.test(err.message))) {
    return err.message;
  }
  return fallback;
}
