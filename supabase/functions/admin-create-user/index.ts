import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-authorization, x-client-info, apikey, content-type",
};

type CreateUserRequest = {
  email: string;
  password: string;
  role: "admin" | "teacher" | "parent" | "guard" | "clinic";
  full_name: string;
  phone?: string | null;
  username?: string | null;
  employee_no?: string | null;
  address?: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: "Missing Supabase env vars" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing Authorization header" }, 401);
    const userAuthHeader = req.headers.get("x-authorization") ?? authHeader;

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: userAuthHeader } },
    });

    const { data: callerAuth, error: callerAuthError } = await callerClient.auth.getUser();
    if (callerAuthError || !callerAuth?.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", callerAuth.user.id)
      .single();
    if (callerProfileError) return jsonResponse({ error: callerProfileError.message }, 403);
    if (callerProfile?.role !== "admin") return jsonResponse({ error: "Forbidden" }, 403);

    const payload = (await req.json()) as CreateUserRequest;
    if (!payload?.email || !payload?.password || !payload?.role || !payload?.full_name) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { full_name: payload.full_name },
    });

    if (createError || !created?.user) {
      return jsonResponse({ error: createError?.message ?? "Create user failed" }, 400);
    }

    const userId = created.user.id;

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: userId,
      role: payload.role,
      full_name: payload.full_name,
      phone: payload.phone ?? null,
      email: payload.email,
      username: payload.username ?? null,
      is_active: true,
    });
    if (profileError) return jsonResponse({ error: profileError.message }, 400);

    if (payload.role === "teacher") {
      const { error } = await adminClient.from("teachers").upsert({
        id: userId,
        employee_no: payload.employee_no ?? null,
      });
      if (error) return jsonResponse({ error: error.message }, 400);
    } else if (payload.role === "clinic") {
      const { error } = await adminClient.from("clinic_staff").upsert({ id: userId });
      if (error) return jsonResponse({ error: error.message }, 400);
    } else if (payload.role === "guard") {
      const { error } = await adminClient.from("guards").upsert({ id: userId });
      if (error) return jsonResponse({ error: error.message }, 400);
    } else if (payload.role === "parent") {
      const { error } = await adminClient.from("parents").upsert({
        id: userId,
        address: payload.address ?? null,
      });
      if (error) return jsonResponse({ error: error.message }, 400);
    } else if (payload.role === "admin") {
      const { error } = await adminClient.from("admin_staff").upsert({ id: userId });
      if (error) return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ id: userId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: msg }, 500);
  }
});
