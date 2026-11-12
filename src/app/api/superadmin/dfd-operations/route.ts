import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
export const GET = withAuthorizedRole(
  ["superadmin"],
  async ({ request, supabaseAdmin }) => {
    const params = request.nextUrl.searchParams;
    const actor = params.get("actor");
    const day = params.get("day");
    const dfd = params.get("dfd");
    let query = supabaseAdmin!
      .from("dfd_operations")
      .select(
        "request_id,actor_id,actor_name,actor_email,actor_role,dfd_id,protocol,action,status,error_code,error_detail,created_at,finished_at,before_data,after_data,request_data",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (actor) query = query.eq("actor_id", actor);
    const name = params.get("name");
    if (name) query = query.ilike("actor_name", `%${name}%`);
    if (dfd) query = query.eq("dfd_id", dfd);
    const before = params.get("before");
    if (before) query = query.lt("created_at", before);
    if (day) {
      const start = new Date(`${day}T00:00:00-03:00`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(start.getTime()))
        return NextResponse.json({ error: "Data inválida." }, { status: 400 });
      query = query
        .gte("created_at", start.toISOString())
        .lt("created_at", new Date(start.getTime() + 86400000).toISOString());
    }
    const { data, error } = await query;
    if (error)
      return NextResponse.json(
        { error: "Não foi possível consultar o histórico." },
        { status: 500 },
      );
    return NextResponse.json(
      {
        operations: data,
        nextBefore: data?.length === 100 ? data.at(-1)?.created_at : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
  { requireAdminClient: true },
);
