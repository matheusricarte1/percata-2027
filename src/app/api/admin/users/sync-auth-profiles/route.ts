import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

function readFullName(metadata: Record<string, any> | undefined): string | null {
  const fullName = String(metadata?.full_name || metadata?.name || "").trim();
  if (fullName) return fullName;
  const given = String(metadata?.given_name || "").trim();
  const family = String(metadata?.family_name || "").trim();
  const joined = `${given} ${family}`.trim();
  return joined || null;
}

function readAvatar(metadata: Record<string, any> | undefined): string | null {
  const avatar = String(metadata?.avatar_url || metadata?.picture || "").trim();
  return avatar || null;
}

function isMissingLegacyTableError(error: any): boolean {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("legacy_user_profile_links") &&
    (message.includes("schema cache") ||
      message.includes("could not find the table") ||
      message.includes("does not exist") ||
      message.includes("42p01"))
  );
}

export const POST = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ request, supabaseAdmin, user }) => {
    // Sync varre todo auth.users + faz upsert + linka legacy. É caro: 2/min basta.
    const limited = await enforceRateLimit(
      request,
      { bucket: "users-sync", limit: 2, windowSec: 60 },
      user.id,
    );
    if (limited) return limited;

    const admin = supabaseAdmin!;
    const perPage = 200;
    let page = 1;
    let processed = 0;
    let upserted = 0;
    let linkedLegacy = 0;

    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const users = data?.users || [];
      if (users.length === 0) break;

      for (const authUser of users) {
        const id = String(authUser.id || "").trim();
        const email = String(authUser.email || "").trim().toLowerCase();
        if (!id || !email) continue;

        processed += 1;
        const metadata = (authUser.user_metadata || {}) as Record<string, any>;
        const { data: existingProfile, error: existingProfileError } = await admin
          .from("profiles")
          .select("id,email,full_name,avatar_url,role,campus_id")
          .eq("id", id)
          .maybeSingle();
        if (existingProfileError) throw existingProfileError;

        const fullName = readFullName(metadata);
        const avatarUrl = readAvatar(metadata);
        const payload = {
          id,
          email,
          full_name: fullName || existingProfile?.full_name || null,
          avatar_url: avatarUrl || existingProfile?.avatar_url || null,
          role: existingProfile?.role || "solicitante",
          campus_id: existingProfile?.campus_id || null,
        };

        const { error: upsertError } = await admin
          .from("profiles")
          .upsert(payload, { onConflict: "id" });
        if (upsertError) throw upsertError;
        upserted += 1;

        const { data: legacyUser } = await admin
          .from("legacy_user_directory")
          .select("id,email")
          .ilike("email", email)
          .maybeSingle();

        if (legacyUser?.email) {
          const { error: legacyLinkError } = await admin
            .from("legacy_user_profile_links")
            .upsert(
              {
                legacy_user_id: legacyUser.id || null,
                legacy_email: email,
                profile_id: id,
                profile_email: email,
                link_source: "email_exact",
                link_state: "active",
              },
              { onConflict: "legacy_email" },
            );

          if (legacyLinkError && !isMissingLegacyTableError(legacyLinkError)) {
            throw legacyLinkError;
          }
          if (!legacyLinkError) linkedLegacy += 1;
        }
      }

      if (users.length < perPage) break;
      page += 1;
    }

    return NextResponse.json({
      ok: true,
      processed,
      upserted,
      linkedLegacy,
    });
  },
  { requireAdminClient: true },
);
