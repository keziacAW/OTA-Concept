# OTA POC — Cloudflare Setup Guide

## File yang perlu di-upload ke Cloudflare

```
ota-poc-cloudflare/
├── worker.js       ← upload ini ke Cloudflare Workers
└── wrangler.toml   ← config, edit dulu sebelum deploy
```

---

## Step-by-step Setup

### 1. Buat Cloudflare account
Daftar di https://cloudflare.com (free tier cukup untuk POC)

---

### 2. Buat KV Namespace
Workers & Pages → KV → Create namespace
- Name: `OTA_METADATA`
- Copy the ID yang muncul → paste ke `wrangler.toml` di bagian `id = "REPLACE_WITH_YOUR_KV_ID"`

---

### 3. Buat R2 Bucket
R2 Object Storage → Create bucket
- Name: `ota-bundles`

---

### 4. Buat Worker
Workers & Pages → Create → Hello World template
- Name: `ota-poc`
- Paste isi `worker.js` ke editor

---

### 5. Bind KV dan R2 ke Worker
Di Worker settings → Variables → KV Namespace Bindings:
- Variable name: `OTA_METADATA` → pilih namespace yang dibuat tadi

Di Worker settings → Variables → R2 Bucket Bindings:
- Variable name: `OTA_BUNDLES` → pilih bucket `ota-bundles`

---

### 6. Set Secret Key
Di Worker settings → Variables → Environment Variables (Encrypt):
- Variable name: `UPLOAD_SECRET_KEY`
- Value: buat password bebas, contoh: `aw-ota-secret-2025`

---

## API Endpoints setelah deploy

Base URL: `https://ota-poc.<your-subdomain>.workers.dev`

### Check update (mobile app hit ini)
```
GET /check-update?appVersion=3.5.29&bundleVersion=0

Response:
{
  "shouldUpdate": true,
  "bundleVersion": 1,
  "downloadURL": "https://ota-poc.workers.dev/download/1",
  "isMandatory": false,
  "releasedAt": "2026-03-02T..."
}
```

### Download bundle
```
GET /download/1
→ Returns bundle-1.zip file
```

### Upload bundle baru (developer only)
```
POST /upload
Header: X-Upload-Key: aw-ota-secret-2025

Form data:
- bundle: <zip file>
- bundleVersion: "1"
- targetAppVersions: '["3.5.29"]'
- isMandatory: "false"
```

### Lihat current release
```
GET /releases
Header: X-Upload-Key: aw-ota-secret-2025
```

---

## Test upload bundle (pakai curl)

```bash
curl -X POST https://ota-poc.<subdomain>.workers.dev/upload \
  -H "X-Upload-Key: aw-ota-secret-2025" \
  -F "bundle=@/path/to/bundle.zip" \
  -F "bundleVersion=1" \
  -F 'targetAppVersions=["3.5.29"]' \
  -F "isMandatory=false"
```

## Test check update (pakai curl)

```bash
curl "https://ota-poc.<subdomain>.workers.dev/check-update?appVersion=3.5.29&bundleVersion=0"
```
