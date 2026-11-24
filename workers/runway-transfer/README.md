# Geed Runway ephemeral upload Worker

This Worker is a control-plane endpoint only. It authenticates the Geed user's Supabase session and asks Runway Dev to create an ephemeral upload session. It never receives, buffers, or stores video bytes.

The browser posts the finished MP4/WebM directly to the temporary Runway upload URL returned by `POST /upload-session`. It releases its local Blob and preview URL only after the upload endpoint returns a successful HTTP response. A failed or ambiguous transfer leaves the local Blob intact.

## Routes

- `GET /health` — reports whether the required secrets/configuration exist.
- `POST /upload-session` — verifies the Supabase access token, validates file metadata, and creates a Runway ephemeral upload session.

## Worker variables and secrets

Configure these under Cloudflare Workers & Pages → Worker → Settings → Variables and Secrets:

| Name | Type | Description |
| --- | --- | --- |
| `RUNWAY_API_KEY` | Secret | Runway Dev API key; never put this in browser code or GitHub |
| `GEED_SUPABASE_URL` | Variable | Existing Geed Supabase project URL |
| `GEED_SUPABASE_PUBLISHABLE_KEY` | Variable | Existing Supabase publishable key; not a service-role key |
| `GEED_APP_ORIGINS` | Variable | Comma-separated exact HTTPS origins allowed to call the Worker |

Do not add a Supabase service-role key. User authentication is verified through `/auth/v1/user`.

## First-time Cloudflare setup

1. Open **Workers & Pages** in the Cloudflare Dashboard. This account does not yet have a `workers.dev` subdomain; opening Workers & Pages initializes one.
2. Create a Worker named `geed-runway-transfer`.
3. Deploy `src/index.mjs` as an ES module Worker.
4. Add the variables and Secret above.
5. Set the app's `<meta name="geed-runway-transfer-url" content="...">` to the Worker URL, for example `https://geed-runway-transfer.<your-workers-subdomain>.workers.dev`.
6. Set `GEED_APP_ORIGINS` to the exact origin serving the browser editor, without a trailing slash. Do not use `*`.

This does not enable R2, create a bucket, attach a custom domain, or change DNS.

## Limits and safety

- Runway ephemeral upload limit: 512 bytes to 200 MB.
- Runway URI lifetime: 24 hours. Runway expires the temporary object automatically.
- Runway API version is pinned to `2024-11-06`.
- The Worker never proxies or stores the video file. The browser performs the multipart upload to Runway.
- The Runway upload URL is only returned after Supabase authentication. The API key stays in Worker Secrets.
- The code allowlists Runway S3 upload hosts documented by Runway support. If Runway later returns a new host, update the allowlist only after verifying it against official Runway documentation.
- Browser CORS for the temporary upload URL must be tested with a real Runway Dev API key and purchased credits before treating the workflow as production-ready. If the upload URL does not allow the browser origin, keep the local video and stop; do not report acceptance or free the Blob.

## Manual test plan

1. Confirm `GET /health` returns `available: true`.
2. Sign into Geed in the browser.
3. Render a small MP4/WebM (at least 512 bytes).
4. Verify `POST /upload-session` returns an upload URL, form fields and a `runway://` URI.
5. Submit the multipart form from the browser and verify a successful HTTP response.
6. Confirm the app releases the local Blob/Object URL only after that response.
7. Confirm the temporary URI is usable in Runway Dev within 24 hours.
8. Test invalid sessions, 511-byte files, 200 MB boundary, invalid MIME/extension, API 401/402/429 and browser CORS/network failure.

A successful upload session is not the same as a successful generation. This Worker does not create generation tasks or publish videos.
