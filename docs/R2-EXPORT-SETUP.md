# Geed Hardwin — final video export to Cloudflare R2

Geed renders the finished MP4/WebM in the browser, then uploads the video bytes directly from the browser to a **private Cloudflare R2 bucket**. Vercel only authenticates the signed-in Geed user and creates short-lived presigned URLs; the Vercel API never receives the video bytes.

## Current prerequisite

R2 is not enabled for the connected Cloudflare account yet. The Cloudflare API currently returns error `10042: Please enable R2 through the Cloudflare Dashboard`. Until R2 is activated and credentials are configured, preview and local download continue to work, while the R2 save button remains disabled.

## Enable and configure storage

1. In Cloudflare Dashboard, open **Storage & databases → R2 → Overview** and complete the R2 subscription activation flow. R2 has an included free tier, but overage may be billable; review the current pricing and checkout terms before confirming.
2. Create a **private** bucket named `geed-hardwin-exports`.
3. Create an R2 S3 API token scoped to this bucket with **Object Read & Write** permissions. Keep the secret key private.
4. Add these Vercel environment variables to **Preview** and **Production**, then redeploy:
   - `GEED_R2_ACCOUNT_ID` — Cloudflare account ID
   - `GEED_R2_BUCKET` — `geed-hardwin-exports`
   - `GEED_R2_ACCESS_KEY_ID` — R2 S3 access key ID
   - `GEED_R2_SECRET_ACCESS_KEY` — R2 S3 secret access key
5. Set the bucket CORS policy to allow the exact Geed Production origin and exact Vercel Preview origin. Allow `PUT` and `GET`, allow the `Content-Type` request header, and expose `ETag`. Do not use a wildcard origin for authenticated media storage.
6. Keep the bucket private. The application uses signed URLs; do not enable public bucket access for this workflow.

## Final and temporary exports

- The **Lưu bản hoàn chỉnh lên R2** action stores the final render under `geed-final/<Supabase-user-id>/<random-id>.<extension>`. These objects are not covered by an automatic deletion rule and remain in the private bucket until an authorized owner deletes them.
- The application provides a signed download URL valid for 24 hours. The URL expires, but the final object remains in R2. Use the object key shown after upload to locate it in the Cloudflare dashboard.
- The API retains a separate `temporary` purpose for short-lived exports under `geed-temp/`. If temporary uploads are used, apply a lifecycle rule only to that prefix with a 48-hour age threshold:

```json
{
  "rules": [
    {
      "id": "expire-geed-temporary-exports-48h",
      "conditions": { "prefix": "geed-temp/" },
      "enabled": true,
      "deleteObjectsTransition": {
        "condition": { "type": "Age", "maxAge": 172800 }
      }
    }
  ]
}
```

Lifecycle processing is asynchronous; do not promise deletion at the exact second an object reaches 48 hours. Never apply this lifecycle rule to `geed-final/`.

## Security and limits

- Upload endpoints require a valid signed-in Geed account.
- The server derives the object owner from the verified Supabase user; the client cannot select another user's key.
- Only `video/mp4` and `video/webm` are accepted. Maximum upload size is 512 MiB.
- Upload URLs expire after 15 minutes. Download URLs expire after 24 hours.
- The server returns short-lived presigned URLs, never the R2 secret key.
- Do not log signed URLs; they grant temporary object access.
- The browser uploads directly to R2, avoiding Vercel request-body limits.
- R2 is used for final rendered video files only. Editable Geed project files remain in the user's existing project workflow.

## Notion and social publishing

Notion file storage from inside Geed needs a separate Notion OAuth or integration connection and page/database destination; the ChatGPT Notion connector is not automatically available to a user's Geed website. YouTube and TikTok publishing likewise need their own approved API apps and user OAuth scopes. Those are separate integrations.
