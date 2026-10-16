// After login we send the user to the ?next= page they originally wanted.
// That value comes from the URL, so an attacker could craft
// /login?next=https://evil.example to bounce users to their site after login
// (an "open redirect"). Only same-site paths are allowed through.

export const DEFAULT_AFTER_LOGIN = "/log";

export function safeRedirectPath(next) {
  if (typeof next !== "string") return DEFAULT_AFTER_LOGIN;
  // Must be a path on this site: starts with "/" but not "//" or "/\"
  // (browsers treat both of those as "another website").
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_AFTER_LOGIN;
  }
  // Don't loop back to the login page itself.
  if (next === "/login" || next.startsWith("/login?")) return DEFAULT_AFTER_LOGIN;
  return next;
}
