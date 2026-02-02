import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-authorization, x-client-info, apikey, content-type",
};

type UpdateUserRequest = {
  user_id: string;
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string | null;
  username?: string | null;
  is_active?: boolean;
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

    const payload = (await req.json()) as UpdateUserRequest;
    if (!payload?.user_id) return jsonResponse({ error: "Missing user_id" }, 400);

    if (payload.email || payload.password) {
      const { error } = await adminClient.auth.admin.updateUserById(payload.user_id, {
        email: payload.email,
        password: payload.password,
      });
      if (error) return jsonResponse({ error: error.message }, 400);
    }

    const profileUpdate: Record<string, unknown> = {};
    if (payload.full_name !== undefined) profileUpdate.full_name = payload.full_name;
    if (payload.phone !== undefined) profileUpdate.phone = payload.phone;
    if (payload.username !== undefined) profileUpdate.username = payload.username;
    if (payload.is_active !== undefined) profileUpdate.is_active = payload.is_active;
    if (payload.email !== undefined) profileUpdate.email = payload.email;

    if (Object.keys(profileUpdate).length > 0) {
      const { error } = await adminClient.from("profiles").update(profileUpdate).eq("id", payload.user_id);
      if (error) return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: msg }, 500);
  }
});
