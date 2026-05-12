import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const AUDIT_USERS = {
  solicitante: "auditoria.solicitante@upe.br",
  chefia: "auditoria.chefia@upe.br",
  admin: "auditoria.admin@upe.br",
} as const;

type AuditRole = keyof typeof AUDIT_USERS;

function isAuditRole(value: string | null): value is AuditRole {
  return value === "solicitante" || value === "chefia" || value === "admin";
}

function isLocalhost(request: NextRequest) {
  const host = request.nextUrl.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function resolveNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || !isLocalhost(request)) {
    return NextResponse.json({ error: "Indisponível fora do ambiente local." }, { status: 404 });
  }

  const password = process.env.PERCATA_AUDIT_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { error: "Defina PERCATA_AUDIT_PASSWORD no processo local para usar o login de auditoria." },
      { status: 503 },
    );
  }

  const role = request.nextUrl.searchParams.get("role");
  if (!isAuditRole(role)) {
    return NextResponse.json({ error: "Perfil de auditoria inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: AUDIT_USERS[role],
    password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.redirect(new URL(resolveNext(request.nextUrl.searchParams.get("next")), request.url));
}
