# Cloudinary Account & Preset Setup

This runbook codifies the operational tasks in **PHASE-5 §1.1 Cloudinary Configuration**. Use it whenever you bootstrap a new environment (local, staging, production) or rotate credentials.

## 1. Account & Credentials

1. Sign in to https://cloudinary.com/ (or create an Enterprise sub-account for the workspace).
2. Navigate to **Dashboard → Account Details** and capture:
   - `cloud_name`
   - `api_key`
   - `api_secret`
3. Store the values in the secrets manager for the target environment and update the matching variables in `env/.env.*` (see table below). Never commit real credentials.

| Variable                     | Description                   | Example            |
| ---------------------------- | ----------------------------- | ------------------ |
| `CLOUDINARY_CLOUD_NAME`      | Account cloud name            | `lumi-dev`         |
| `CLOUDINARY_API_KEY`         | API key for signed operations | `1234567890abcdef` |
| `CLOUDINARY_API_SECRET`      | API secret (server-side only) | `super-secret`     |
| `CLOUDINARY_SECURE_DELIVERY` | Force HTTPS URLs              | `true`             |

## 2. Upload Presets & Folders

Create three unsigned upload presets so the backend can reference them declaratively:

| Preset          | Folder          | Purpose                     | Required Settings                                                                                         |
| --------------- | --------------- | --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `lumi_products` | `lumi/products` | Default product photography | Unsigned, incoming transformation = `quality=auto:good`, `format=auto`, enable **Strict Transformations** |
| `lumi_banners`  | `lumi/banners`  | Hero / marketing banners    | Unsigned, incoming transformation = `quality=auto:eco`, `format=auto`, eager transformations enabled      |
| `lumi_avatars`  | `lumi/avatars`  | Customer/staff avatars      | Unsigned, incoming transformation = `quality=auto:good`, `format=auto`, face detection crop optional      |

Steps:

1. Open **Settings → Upload → Upload Presets → Add upload preset**.
2. Set the preset name & folder, enable **Use filename or externally defined public ID**, disable **Unique filename** (the backend enforces uniqueness), and turn on **Overwrite** = false.
3. Under **Incoming Transformations**, set the defaults described above so every upload inherits the quality/format envelope.
4. Record the preset names in the env vars `CLOUDINARY_UPLOAD_PRESET_*`.

## 3. Auto-Upload Mapping (optional fetch)

If we need Cloudinary to automatically fetch remote assets (CDN or S3), configure **Settings → Upload → Auto upload mapping**:

1. Add the domain(s) that host remote assets (e.g., `cdn.lumi.dev`).
2. Map to the relevant folder (e.g., `lumi/fetch`).
3. Keep **Resource type** = `image` and enable `unique_filename` to avoid collisions.

## 4. Transformation Defaults & Breakpoints

The backend expects opinionated defaults for performance (P2):

| Variable                            | Default                           | Notes                                                       |
| ----------------------------------- | --------------------------------- | ----------------------------------------------------------- |
| `CLOUDINARY_DEFAULT_FORMAT`         | `auto`                            | Enables WebP/AVIF negotiation                               |
| `CLOUDINARY_DEFAULT_FETCH_FORMAT`   | `auto`                            | Aligns with browsers that only support fetch-based delivery |
| `CLOUDINARY_DEFAULT_QUALITY`        | `auto:good`                       | Balances fidelity vs. size                                  |
| `CLOUDINARY_DEFAULT_DPR`            | `auto`                            | Ensures high-DPI devices stay crisp                         |
| `CLOUDINARY_RESPONSIVE_BREAKPOINTS` | `320,640,768,1024,1280,1536,1920` | Used when generating `srcset`s                              |

Verify these match the Cloudinary console under **Settings → Images → Default Delivery Type**.

## 5. Webhook Configuration

1. Deploy (or expose via ngrok) the backend endpoint `POST /webhooks/cloudinary`.
2. In Cloudinary, go to **Settings → Webhooks → Add notification URL**.
3. Enter the environment URL (e.g., `https://api.lumi.dev/webhooks/cloudinary`).
4. Copy the signing secret and set `CLOUDINARY_WEBHOOK_SIGNING_SECRET`.
5. Enable the following events for now: `upload`, `destroy`, `derived`, `moderation`. More can be toggled later.
6. Test the webhook via the dashboard. The backend should return `200` and log the event ID.

## 6. Validation Checklist

- [ ] All env vars updated in the secrets backend & `.env` template.
- [ ] Upload presets created and locked (document IDs in runbook notes).
- [ ] Auto-upload mapping enabled (if required).
- [ ] Default delivery options set to WebP/AVIF + auto quality.
- [ ] Webhook URL reachable from Cloudinary and signing secret rotated.
- [ ] Credentials stored in password manager with rotation reminder (90 days default).

Store screenshots or PDF exports of the configuration in the secure ops vault for audit trails.
