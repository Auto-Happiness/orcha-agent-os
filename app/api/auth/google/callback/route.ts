import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { KeyManager } from "@/lib/key-manager";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Helper to return an HTML page that communicates back to the opener window
 * and then closes itself. Good for OAuth popup flows.
 */
function closeWindowWithPostMessage(data: { success: boolean; integration?: string; error?: string }) {
  return new NextResponse(`
    <html>
      <body style="background: #0d0a1a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
        <div style="text-align: center;">
          <p>${data.success ? "Authentication successful!" : "Authentication failed."}</p>
          <p style="font-size: 12px; color: #a855f7;">Closing window...</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage(${JSON.stringify({ type: "GOOGLE_OAUTH_RESULT", ...data })}, "*");
          }
          setTimeout(() => window.close(), 1000);
        </script>
      </body>
    </html>
  `, { headers: { "Content-Type": "text/html" } });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    console.error(`[GoogleOAuth] User denied consent: ${error}`);
    return closeWindowWithPostMessage({ success: false, error: "oauth_denied" });
  }

  if (!code || !stateRaw) {
    return closeWindowWithPostMessage({ success: false, error: "missing_params" });
  }

  // Decode context from state
  let orgId: string, integration: string;
  try {
    const state = JSON.parse(Buffer.from(stateRaw, "base64").toString());
    orgId = state.orgId;
    integration = state.integration;
  } catch {
    return closeWindowWithPostMessage({ success: false, error: "invalid_state" });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("[GoogleOAuth] Token exchange failed:", err);
      return closeWindowWithPostMessage({ success: false, error: "token_exchange_failed" });
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    const credential = JSON.stringify({
      access_token,
      refresh_token: refresh_token || null,
      expires_at: Date.now() + (expires_in - 60) * 1000,
    });

    const { processedValue, strategy } = await KeyManager.prepareForStorage({
      organizationId: orgId,
      provider: integration,
      keyType: "oauth_google",
      keyValue: credential,
    });

    // We use a privileged action call here because the server route
    // doesn't have the user's Clerk context. Protected by CONVEX_INTERNAL_SECRET.
    await convex.action(api.integrationActions.saveKeyWithSecret, {
      secret: process.env.CONVEX_INTERNAL_SECRET || "development_secret",
      organizationId: orgId as any,
      integration,
      keyType: "oauth_google",
      keyValue: processedValue,
      storageStrategy: strategy,
    });

    return closeWindowWithPostMessage({ success: true, integration });

  } catch (e: any) {
    console.error("[GoogleOAuth] Unexpected error:", e.message);
    return closeWindowWithPostMessage({ success: false, error: "server_error" });
  }
}
