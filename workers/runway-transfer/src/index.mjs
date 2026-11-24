const RUNWAY_UPLOAD_ENDPOINT = "https://api.dev.runwayml.com/v1/uploads";
const RUNWAY_API_VERSION = "2024-11-06";
const MIN_FILE_BYTES = 512;
const MAX_FILE_BYTES = 200 * 1024 * 1024;
const UPLOAD_HOSTS = new Set([
  "runway-datasets.s3.amazonaws.com",
  "runway-datasets.s3.us-east-1.amazonaws.com",
  "runway-uploads-prod.s3.amazonaws.com",
  "runway-uploads-prod.s3.us-east-1.amazonaws.com"
]);

function allowedOrigins(env) {
  return new Set(String(env.GEED_APP_ORIGINS || "")
    .split(",").map(value => value.trim()).filter(Boolean));
}

function corsHeaders(origin, env) {
  const headers = new Headers({
    "cache-control": "no-store",
    "vary": "Origin",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type",
    "access-control-max-age": "600"
  });
  if (origin && allowedOrigins(env).has(origin)) {
    headers.set("access-control-allow-origin", origin);
  }
  return headers;
}

function jsonResponse(payload, status, origin, env) {
  const headers = corsHeaders(origin, env);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(payload), { status, headers });
}

function getBearerToken(request) {
  const value = String(request.headers.get("authorization") || "");
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function verifySupabaseUser(token, env, fetchImpl) {
  const supabaseUrl = String(env.GEED_SUPABASE_URL || "").replace(/\/+$/, "");
  const publishableKey = String(env.GEED_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!supabaseUrl || !publishableKey) throw new Error("SUPABASE_NOT_CONFIGURED");
  const response = await fetchImpl(supabaseUrl + "/auth/v1/user", {
    method: "GET",
    headers: {
      apikey: publishableKey,
      authorization: "Bearer " + token,
      accept: "application/json"
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user && typeof user.id === "string" ? { id: user.id } : null;
}

function normalizeFileMetadata(body) {
  const filename = String(body?.filename || "").split(/[\\/]/).pop().trim();
  const contentType = String(body?.contentType || "").toLowerCase();
  const size = Number(body?.size);
  const extension = contentType === "video/mp4" ? ".mp4"
    : contentType === "video/webm" ? ".webm" : "";
  if (!extension) return { error: "Only MP4 and WebM files are supported.", code: "UNSUPPORTED_MEDIA_TYPE" };
  if (!Number.isSafeInteger(size) || size < MIN_FILE_BYTES || size > MAX_FILE_BYTES) {
    return { error: "Runway accepts files from 512 bytes up to 200 MB.", code: "RUNWAY_FILE_SIZE_LIMIT" };
  }
  if (filename.length < 3 || filename.length > 255 ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename) ||
      !filename.toLowerCase().endsWith(extension)) {
    return { error: "Filename must be safe and match its video format.", code: "INVALID_FILENAME" };
  }
  return { filename, contentType, size };
}

function isValidRunwayUploadUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && UPLOAD_HOSTS.has(url.hostname) &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

async function handleRequest(request, env, fetchImpl = fetch) {
  const origin = request.headers.get("origin") || "";
  if (!origin || !allowedOrigins(env).has(origin)) {
    return jsonResponse({ error: "Origin is not allowed.", code: "ORIGIN_NOT_ALLOWED" }, 403, origin, env);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
  }

  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") {
    const ready = Boolean(env.RUNWAY_API_KEY && env.GEED_SUPABASE_URL && env.GEED_SUPABASE_PUBLISHABLE_KEY);
    return jsonResponse({
      available: ready,
      reason: ready ? null : "RUNWAY_TRANSFER_NOT_CONFIGURED",
      message: ready ? null : "Worker thiếu Runway API key hoặc cấu hình Supabase.",
      maxUploadBytes: MAX_FILE_BYTES,
      minUploadBytes: MIN_FILE_BYTES,
      expiresInSeconds: 24 * 60 * 60
    }, 200, origin, env);
  }

  if (request.method !== "POST" || url.pathname !== "/upload-session") {
    return jsonResponse({ error: "Not found.", code: "NOT_FOUND" }, 404, origin, env);
  }

  const apiKey = String(env.RUNWAY_API_KEY || "").trim();
  if (!apiKey) {
    return jsonResponse({
      error: "Runway Dev API key has not been configured as a Worker Secret.",
      code: "RUNWAY_API_NOT_CONFIGURED"
    }, 503, origin, env);
  }

  const token = getBearerToken(request);
  if (!token) {
    return jsonResponse({ error: "Sign in to Geed before sending a video.", code: "AUTH_REQUIRED" }, 401, origin, env);
  }

  let user;
  try {
    user = await verifySupabaseUser(token, env, fetchImpl);
  } catch (error) {
    return jsonResponse({ error: "Geed account verification is unavailable.", code: "AUTH_SERVICE_UNAVAILABLE" }, 503, origin, env);
  }
  if (!user) {
    return jsonResponse({ error: "Your Geed session is invalid or expired.", code: "INVALID_SESSION" }, 401, origin, env);
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return jsonResponse({ error: "Invalid JSON request body.", code: "INVALID_REQUEST" }, 400, origin, env);
  }

  const file = normalizeFileMetadata(body);
  if (file.error) {
    const status = file.code === "RUNWAY_FILE_SIZE_LIMIT" ? 413 : 400;
    return jsonResponse({ error: file.error, code: file.code }, status, origin, env);
  }

  let upstream;
  try {
    upstream = await fetchImpl(RUNWAY_UPLOAD_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: "Bearer " + apiKey,
        "X-Runway-Version": RUNWAY_API_VERSION,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({ filename: file.filename, type: "ephemeral" }),
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    return jsonResponse({ error: "Could not create a Runway upload session.", code: "RUNWAY_API_UNAVAILABLE" }, 502, origin, env);
  }

  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    if (upstream.status === 402 || upstream.status === 403) {
      return jsonResponse({
        error: "Runway did not authorize ephemeral uploads. Check the Dev API key and purchased credits.",
        code: upstream.status === 402 ? "RUNWAY_CREDITS_REQUIRED" : "RUNWAY_ACCESS_DENIED"
      }, upstream.status, origin, env);
    }
    if (upstream.status === 429) {
      return jsonResponse({ error: "Runway upload-session rate limit reached. Try again later.", code: "RUNWAY_RATE_LIMITED" }, 429, origin, env);
    }
    return jsonResponse({ error: "Runway rejected the upload-session request.", code: "RUNWAY_SESSION_REJECTED" }, 502, origin, env);
  }

  const uploadUrl = payload.uploadUrl;
  const fields = payload.fields;
  const runwayUri = payload.runwayUri;
  if (!isValidRunwayUploadUrl(uploadUrl) ||
      !fields || typeof fields !== "object" || Array.isArray(fields) ||
      !Object.entries(fields).every(([key, value]) => key.length > 0 && typeof value === "string") ||
      typeof runwayUri !== "string" || !runwayUri.startsWith("runway://") || runwayUri.length > 2048) {
    return jsonResponse({ error: "Runway returned an invalid temporary upload session.", code: "INVALID_RUNWAY_SESSION" }, 502, origin, env);
  }

  // The video bytes never pass through this Worker. Only metadata and a
  // provider-issued temporary URL are returned to the authenticated browser.
  return jsonResponse({
    uploadUrl,
    fields,
    runwayUri,
    expiresInSeconds: 24 * 60 * 60,
    maxUploadBytes: MAX_FILE_BYTES
  }, 200, origin, env);
}

export { handleRequest, normalizeFileMetadata, isValidRunwayUploadUrl };

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
};
