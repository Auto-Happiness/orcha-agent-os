/**
 * Resolves a raw Google credential string (which may be a JSON blob
 * containing { access_token, refresh_token, expires_at }) into a
 * fresh, usable access token.
 *
 * If the token is expired, it automatically refreshes using the
 * stored refresh_token and the configured Google OAuth credentials.
 */
export async function resolveGoogleAccessToken(credential: string): Promise<string> {
  if (!credential || credential === "none") {
    throw new Error("No Google credential stored. Please reconnect via the Marketplace.");
  }

  // Single string token (not a JSON blob) — return as-is
  if (!credential.trim().startsWith("{")) {
    return credential;
  }

  const { access_token, refresh_token, expires_at } = JSON.parse(credential);

  // Token still valid — use it directly
  if (expires_at && Date.now() < expires_at) {
    return access_token;
  }

  // Token expired — refresh it
  if (!refresh_token) {
    throw new Error("Google OAuth token expired and no refresh_token is available. Please reconnect via the Marketplace.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars are not set.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token refresh failed: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}
