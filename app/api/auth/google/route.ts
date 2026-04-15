import { NextRequest, NextResponse } from "next/server";
import { getMcpServer } from "@/lib/mcp-registry";

/**
 * GET /api/auth/google?integration=gmail&orgId=org_xxx&slug=my-org
 *
 * Redirects the user to Google's OAuth consent screen.
 * The `state` param encodes the orgId, integration key, and return slug
 * so the callback can restore context and save the tokens correctly.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const integration = searchParams.get("integration");
  const orgId = searchParams.get("orgId");
  const slug = searchParams.get("slug");

  if (!integration || !orgId || !slug) {
    return NextResponse.json({ error: "Missing required params: integration, orgId, slug" }, { status: 400 });
  }

  const reg = getMcpServer(integration);
  if (!reg || reg.credentialType !== "oauth_google" || !reg.oauthScopes?.length) {
    return NextResponse.json({ error: "Integration does not support Google OAuth" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID is not configured." }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  // Encode context in state (CSRF is handled by Google's short-lived code)
  const state = Buffer.from(JSON.stringify({ orgId, integration, slug })).toString("base64");

  const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  oauthUrl.searchParams.set("client_id", clientId);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("scope", reg.oauthScopes.join(" "));
  oauthUrl.searchParams.set("access_type", "offline");       // get refresh token
  oauthUrl.searchParams.set("prompt", "consent");            // force consent to always get refresh_token
  oauthUrl.searchParams.set("state", state);

  return NextResponse.redirect(oauthUrl.toString());
}
