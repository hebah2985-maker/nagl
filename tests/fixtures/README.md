# Test Fixtures

This directory contains sample PDFs for QA automation and end-to-end testing.

## Sample PDFs

| File | Title | Type | Pages | Chunks | Content |
|---|---|---|---|---|---|
| `sample_tafsir.pdf` | جامع البيان عن تأويل آي القرآن (تفسير الطبري) | tafsir | 5 | ~7 | Tabari's methodology + Israiliyyat + Qira'at |
| `sample_hadith.pdf` | مختارات من صحيح البخاري | hadith | 5 | ~5 | Selected hadiths from Sahih al-Bukhari (Iman, Ilm, Wudu, Salah) |

## Using the test fixtures

### Option 1: Upload via the UI

1. Start the dev server: `bun run dev`
2. Open the app in a browser
3. Go to المكتبة → ارفع ملف PDF
4. Drag/select one of the sample PDFs
5. Fill metadata → click رفع وفهرسة

### Option 2: Upload via the seed endpoint (test-only, no UI needed)

```bash
# Get test account + existing sources
curl http://localhost:3000/api/seed

# Upload + auto-process a sample PDF
curl -X POST http://localhost:3000/api/seed \
  -F "file=@tests/fixtures/sample_tafsir.pdf" \
  -F "title=تفسير الطبري" \
  -F "author=الطبري" \
  -F "sourceType=tafsir"
```

### Option 3: Upload via the library API (requires auth session for gated features)

```bash
# 1. Get CSRF + login
CSRF=$(curl -s -c cookies.txt http://localhost:3000/api/auth/csrf | python3 -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
curl -s -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=test@naql-muhaqqiq.local&password=test123456&csrfToken=$CSRF"

# 2. Upload PDF
curl -b cookies.txt -X POST http://localhost:3000/api/library \
  -F "file=@tests/fixtures/sample_tafsir.pdf" \
  -F "title=تفسير الطبري" \
  -F "sourceType=tafsir"

# 3. Process (index) the uploaded source
curl -b cookies.txt -X POST http://localhost:3000/api/library/<sourceId>/process
```

## Test account (seeded)

- **Email**: `test@naql-muhaqqiq.local`
- **Password**: `test123456`
- **Name**: مستخدم اختبار

This account is auto-created by `GET /api/seed` (test-only, not available in production).

## Server-side logging

Missing-source and empty-search events are logged to stdout (visible in `dev.log`):

```
[missing-source] 2026-10-07T03:04:49Z route=/api/library/[id] sourceId=invalid-id reason=not_found
[empty-search] 2026-10-07T03:04:49Z route=/api/search question=... sources=[...] chunks_found=0
```

Grep for these lines to catch regressions (deleted sources still referenced, broken imports, etc.).
