import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { error: "Missing Supabase environment variables." });
  }

  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "Missing bearer token." });
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user) {
    return json(401, { error: "Could not verify caller identity." });
  }

  const { data: isSuperAdmin, error: superAdminError } = await callerClient.rpc("is_super_admin");
  if (superAdminError) {
    return json(403, { error: "Could not verify super-admin privileges." });
  }
  if (!isSuperAdmin) {
    return json(403, { error: "Super-admin access required." });
  }

  const body = await req.json().catch(() => null);
  const targetUserId =
    body && typeof body === "object" && "targetUserId" in body && typeof body.targetUserId === "string"
      ? body.targetUserId.trim()
      : "";

  if (!targetUserId) {
    return json(400, { error: "targetUserId is required." });
  }

  if (targetUserId === callerData.user.id) {
    return json(400, { error: "You cannot delete your own super-admin account." });
  }

  const { data: targetProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("id,is_frozen,role")
    .eq("id", targetUserId)
    .maybeSingle();

  if (profileError) {
    return json(500, { error: profileError.message });
  }

  if (!targetProfile) {
    return json(404, { error: "Target profile not found." });
  }

  if (!targetProfile.is_frozen) {
    return json(400, { error: "Target account must be frozen first." });
  }

  if (targetProfile.role === "super_admin") {
    return json(400, { error: "Super-admin accounts cannot be deleted." });
  }

  const { data: targetAuthUser, error: targetAuthError } = await adminClient.auth.admin.getUserById(targetUserId);
  if (targetAuthError || !targetAuthUser.user) {
    return json(404, { error: "Target auth user not found." });
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
  if (deleteError) {
    return json(500, { error: deleteError.message });
  }

  return json(200, { ok: true });
});
