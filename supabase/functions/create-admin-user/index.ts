// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ success: false, error: "Supabase function secrets are not configured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";

  if (!token) {
    return jsonResponse({ success: false, error: "Missing bearer token" }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
  const caller = callerData?.user;

  if (callerError || !caller) {
    return jsonResponse({ success: false, error: "Invalid bearer token" }, 401);
  }

  const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, status")
    .eq("id", caller.id)
    .single();

  if (callerProfileError || !callerProfile) {
    return jsonResponse({ success: false, error: "Caller profile was not found" }, 403);
  }

  if (callerProfile.role !== "admin" || callerProfile.status !== "approved") {
    return jsonResponse({ success: false, error: "Caller is not an approved administrator" }, 403);
  }

  let body: {
    email?: string;
    password?: string;
    display_name?: string;
    preferred_language?: string;
  };

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON body" }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password || "";
  const displayName = body.display_name?.trim() || email;
  const preferredLanguage = body.preferred_language === "zh" ? "zh" : "en";

  if (!email || !password || !displayName) {
    return jsonResponse({ success: false, error: "email, password, and display_name are required" }, 400);
  }

  const { data: createdUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
    },
  });

  const createdUser = createdUserData?.user;

  if (createUserError || !createdUser) {
    return jsonResponse({
      success: false,
      error: createUserError?.message || "Failed to create admin auth user",
    }, 400);
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert({
      id: createdUser.id,
      email,
      display_name: displayName,
      role: "admin",
      status: "approved",
      preferred_language: preferredLanguage,
    }, { onConflict: "id" });

  if (profileError) {
    return jsonResponse({
      success: false,
      error: profileError.message || "Failed to create admin profile",
    }, 500);
  }

  return jsonResponse({
    success: true,
    user: {
      id: createdUser.id,
      email,
      display_name: displayName,
      role: "admin",
      status: "approved",
      preferred_language: preferredLanguage,
    },
  });
});
