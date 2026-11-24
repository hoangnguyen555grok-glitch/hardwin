# Geed Hardwin — video handoff through Cloudflare R2 to Runway

Geed renders the finished MP4/WebM in the browser, uploads it directly from the browser to a **private Cloudflare R2 bucket**, then asks the Geed server to transfer the object to the Runway Dev upload API. The server deletes the R2 object **only after Runway's file-upload endpoint returns success**. Failed or unconfirmed transfers leave the R2 object in place for retry.

R2 is a relay/staging point in this workflow, not the permanent video archive. The bucket and its credentials are retained when individual video objects are deleted.

## Current prerequisites

R2 must be enabled and configured for the Cloudflare account. The production endpoint currently returns `R2_NOT_CONFIGURED` until activation, bucket creation, and Vercel environment configuration are complete.

The site also needs its own **Runway Dev API key** in Vercel as `GEED_RUNWAY_API_KEY`. A Runway connection inside ChatGPT is not automatically available to the Geed website: the website runs on Vercel and needs a server-side Runway API credential.

## Enable and configure R2

1. In Cloudflare Dashboard, open **Storage & databases → R2 → Overview** and complete the activation flow only after reviewing the current billing terms. The standard R2 free allowance is 10 GB-month storage, 1 million Class A operations, and 10 million Class B operations per month; overages can be billed.
2. Create a **private** bucket named `geed-hardwin-exports`.
3. Create an R2 S3 API token scoped to this bucket with **Object Read & Write** permissions. Keep the secret key private.
4. Add these Vercel environment variables to **Preview** and **Production**, then redeploy:
   - `GEED_R2_ACCOUNT_ID` — Cloudflare account ID
   - `GEED_R2_BUCKET` — `geed-hardwin-exports`
   - `GEED_R2_ACCESS_KEY_ID` — R2 S3 access key ID
   - `GEED_R2_SECRET_ACCESS_KEY` — R2 S3 secret access key
5. Set the bucket CORS policy to allow the exact Geed Production origin and exact Vercel Preview origin. Allow `PUT` and `GET`, allow the `Content-Type` request header, and expose `ETag`. Do not use a wildcard origin for authenticated media storage.
6. Keep the bucket private. The application uses short-lived signed URLs; do not enable public bucket access.

## Configure Runway handoff

1. Create a Runway Dev API key in the Runway developer portal.
2. Add `GEED_RUNWAY_API_KEY` to Vercel for **Preview** and **Production** as a sensitive secret. Do not put it in the browser, repository, or chat messages.
3. The Geed action **Gửi video qua R2 đến Runway** first uploads the render to `geed-final/<Supabase-user-id>/<random-id>.<extension>`, then starts a Runway ephemeral upload using `POST /v1/uploads` with API version `2024-11-06`.
4. The Geed server downloads the private R2 object and sends it to the temporary Runway upload URL. On a successful upload response, it signs a `DELETE` request for that exact R2 object. The R2 bucket, CORS rules, API token, and Vercel environment variables remain in place for the next video.
5. If Runway refuses the upload, the network fails, or the file is too large, Geed does **not** delete the source object. The UI offers a retry. If Runway accepted the upload but R2 cleanup failed, the UI offers a cleanup-only retry so it does not upload the same file a second time.

## Runway ephemeral upload limitations

- Runway ephemeral upload accepts files from 512 bytes through 200 MB. Geed's R2 upload route accepts up to 512 MiB, but files larger than 200 MB cannot be forwarded through this Runway upload path and remain in R2.
- Runway's returned `runway://` URI is temporary and valid for 24 hours; it is not a permanent asset in the Runway web app's Assets library.
- Runway's documentation says purchased credits are required to use the ephemeral uploads feature. If the connected Runway developer workspace does not have the required credits or API access, the upload fails and Geed retains the R2 copy.
- Uploading a file to Runway only hands over the video. It does not itself start a generation/edit task or publish the video to YouTube/TikTok. Those are separate integrations/workflows.

## Retention and safety

- The successful handoff deletes only the exact object key owned by the signed-in Geed user.
- Objects are stored under `geed-final/<Supabase-user-id>/`; the server validates the owner prefix before forwarding or deleting.
- The R2 bucket is not deleted. Deleting an object does not remove its bucket or configuration.
- Do not apply an automatic deletion lifecycle rule to `geed-final/` while the handoff is being validated. Failed transfers intentionally remain available for retry.
- Only MP4 and WebM are accepted. R2 upload URLs expire after 15 minutes. R2 download URLs used by the server-side relay are short-lived and never shown to the user.
- Do not log signed URLs or the Runway API key.
- Editable Geed project files remain in the existing project workflow; only the rendered video is relayed through R2.
