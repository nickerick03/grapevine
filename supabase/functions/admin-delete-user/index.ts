import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(status: number, payload: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...buildCorsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, origin);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json(500, {
        error: "Missing Supabase environment variables.",
        code: "MISSING_ENV",
      }, origin);
    }

    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Missing bearer token.", code: "MISSING_BEARER" }, origin);
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
      return json(401, {
        error: "Could not verify caller identity.",
        code: "CALLER_UNVERIFIED",
      }, origin);
    }

    const { data: isSuperAdmin, error: superAdminError } = await callerClient.rpc("is_super_admin");
    if (superAdminError) {
      return json(403, {
        error: "Could not verify super-admin privileges.",
        code: "SUPER_ADMIN_CHECK_FAILED",
      }, origin);
    }
    if (!isSuperAdmin) {
      return json(403, { error: "Super-admin access required.", code: "FORBIDDEN" }, origin);
    }

    const contentType = req.headers.get("content-type") ?? "";
    const body = contentType.toLowerCase().includes("application/json")
      ? await req.json().catch(() => null)
      : null;
    const targetUserId =
      body && typeof body === "object" && "targetUserId" in body && typeof body.targetUserId === "string"
        ? body.targetUserId.trim()
        : "";

    if (!targetUserId) {
      return json(400, { error: "targetUserId is required.", code: "MISSING_TARGET_USER_ID" }, origin);
    }

    if (targetUserId === callerData.user.id) {
      return json(400, {
        error: "You cannot delete your own super-admin account.",
        code: "SELF_DELETE_BLOCKED",
      }, origin);
    }

    const { data: targetProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("id,is_frozen,role")
      .eq("id", targetUserId)
      .maybeSingle();

    if (profileError) {
      return json(500, { error: profileError.message, code: "PROFILE_LOOKUP_FAILED" }, origin);
    }

    if (!targetProfile) {
      return json(404, { error: "Target profile not found.", code: "PROFILE_NOT_FOUND" }, origin);
    }

    if (!targetProfile.is_frozen) {
      return json(400, {
        error: "Target account must be frozen first.",
        code: "ACCOUNT_NOT_FROZEN",
      }, origin);
    }

    if (targetProfile.role === "super_admin") {
      return json(400, {
        error: "Super-admin accounts cannot be deleted.",
        code: "SUPER_ADMIN_DELETE_BLOCKED",
      }, origin);
    }

    const { data: targetAuthUser, error: targetAuthError } = await adminClient.auth.admin.getUserById(targetUserId);
    if (targetAuthError || !targetAuthUser.user) {
      return json(404, { error: "Target auth user not found.", code: "AUTH_USER_NOT_FOUND" }, origin);
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (deleteError) {
      return json(500, { error: deleteError.message, code: "AUTH_DELETE_FAILED" }, origin);
    }

    return json(200, { ok: true, deleted_user_id: targetUserId }, origin);
  } catch (error) {
    console.error("admin-delete-user unhandled error", error);
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return json(500, { error: message, code: "UNHANDLED" }, origin);
  }
});
