# Geed Hardwin — temporary video export to Cloudflare R2

This feature keeps video rendering in the browser. Geed creates a finished MP4/WebM preview with the animation and audio tracks, then the browser uploads that blob directly to a private R2 bucket using a short-lived, user-scoped presigned URL. The Vercel API never receives the video bytes.

## Current prerequisite

R2 is not enabled for the connected Cloudflare account yet. The Cloudflare API currently returns error `10042: Please enable R2 through the Cloudflare Dashboard`. Until R2 has been enabled and credentials have been configured, the Preview and local download work, while the **Lưu tạm lên R2** button remains disabled.

## Enable and configure storage

1. In Cloudflare Dashboard, open **R2 Object Storage** and enable R2 for the account.
2. Create a **private** bucket named `geed-hardwin-exports`.
3. Create an R2 S3 API token scoped to this bucket with Object Read & Write permissions. Keep the secret key private.
4. Add these Vercel environment variables to **Preview** and **Production** (and redeploy after changing them):

   - `GEED_R2_ACCOUNT_ID` — Cloudflare account ID
   - `GEED_R2_BUCKET` — `geed-hardwin-exports`
   - `GEED_R2_ACCESS_KEY_ID` — R2 S3 access key ID
   - `GEED_R2_SECRET_ACCESS_KEY` — R2 S3 secret access key

5. Set the bucket CORS policy so browser uploads are accepted from the Geed Production origin and the exact Vercel Preview origin. Allow `PUT` and `GET`, allow the `Content-Type` request header, and expose `ETag`. Do not use a wildcard origin for authenticated media storage.
6. Keep the bucket private. The application uses signed URLs; do not enable public bucket access for this workflow.

## Automatic cleanup

Apply an R2 Object Lifecycle rule only to the `geed-temp/` prefix. The intended rule is a two-day age threshold:

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

`maxAge` is in seconds. R2 lifecycle processing is asynchronous; do not promise deletion at the exact second the object reaches 48 hours. Cloudflare can take additional time to apply lifecycle actions. The application signs the upload URL for 15 minutes and the read URL for 24 hours. The read URL is temporary and must not be treated as a permanent asset link.

## Security and limits

- Upload endpoints require a valid signed-in Geed account.
- Each object is written under `geed-temp/<Supabase-user-id>/<random-id>.<extension>`; the client cannot choose another user's key.
- Only `video/mp4` and `video/webm` are accepted. Maximum upload size is 512 MiB.
- The server returns short-lived presigned URLs, never the R2 secret key.
- Do not log signed URLs; they grant temporary object access.
- The video blob is uploaded directly from the browser to R2, avoiding Vercel request-body limits.

## Notion and social publishing

Notion file storage from inside Geed needs a separate Notion OAuth or integration connection and page/database destination; the ChatGPT Notion connector is not automatically available to a user's Geed website. YouTube and TikTok publishing likewise need their own approved API apps and user OAuth scopes. Those are follow-on integrations, not enabled by the R2 export switch.
