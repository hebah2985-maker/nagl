# نقل محقق — منصة البحث والتحقق في المصادر الشرعية

> "نقل محقق لا يستبدل الباحث؛ بل يساعده على الوصول إلى الدليل والتحقق منه."

**نقل محقق** هو منصة ذكاء اصطناعي للبحث والتحقق والتوثيق في المصادر الشرعية، موجّهة أساسًا لطلاب العلم والباحثين والدكاترة والمحققين. المبدأ الأساسي: **الذكاء الاصطناعي ليس مصدرًا للمعلومة — المصادر هي مصدر المعلومة**، والـ AI دوره هو فهم السؤال، البحث داخل المصادر المسموح بها، استخراج النصوص ذات الصلة، مطابقتها، تحديد موضعها، مقارنة الاقتباس بالأصل، تلخيص أو تحليل المادة الموجودة في المصادر، صياغة إجابة مفهومة مع إسناد كل معلومة إلى مصدرها، والامتناع عن الإجابة عندما لا توجد مرجعية كافية.

## المبدأ الأساسي

هذا ليس "ChatGPT بواجهة زرقاء". هذا **أداة بحث وتحقق شرعي** تستخدم الذكاء الاصطناعي لتختصر ساعات من البحث، لكنها لا تتجاوز المصدر. المسار الأساسي للنظام:

```
Source → Retrieval → Evidence → Answer → Citation → Verification
```

وليس:

```
Question → LLM → Answer
```

## الميزات (Must Have — جميعها مُنفّذة في الـ MVP)

- ✅ رفع PDF (نصي + مصور) مع استخراج النص عبر Poppler `pdftotext` و fallback إلى pdfjs-dist.
- ✅ **معالجة النص العربي**: تحويل presentation forms (U+FB50–U+FEFF) إلى حروف عربية طبيعية، إزالة علامات BIDI، حفظ RTL حقيقي.
- ✅ مكتبة المستخدم + سجل المصادر المعتمدة (القرآن، الطبري، البخاري، مسلم، لسان العرب، الدرر السنية، المكتبة الشاملة...).
- ✅ الفهرسة: تقسيم المحتوى إلى مقاطع (chunking) مع حفظ `source_id, page, chapter, section, original_text`.
- ✅ **Hybrid Search**: بحث نصي (TF على نص طبيعي) + إعادة ترتيب دلالي عبر LLM.
- ✅ **RAG**: استرجاع الأدلة → تمريرها للنموذج مع prompt صارم → إجابة موثقة.
- ✅ **Grounded Answers**: كل إجابة تحتوي على الخلاصة + الادعاءات المُدقّقة + الأدلة + ملاحظات التحقق + درجة الثقة.
- ✅ **Citation Markers**: كل ادعاء مربوط بدليل `[1] [2]` مع انتقال مباشر للصفحة.
- ✅ **Citation Validator**: طبقة برمجية تفحص كل claim — إذا لم يكن له evidence يُحذف أو يُعلّم.
- ✅ **التحقق من الاقتباسات**: مقارنة side-by-side مع diff ملوّن (إضافة/حذف/تغيير) ونسبة تطابق آلية + تنبيه "مؤشر آلي أولي وليس حكمًا علميًا".
- ✅ **Source Policy Engine**: طبقة برمجية تحدد المصادر المسموح بها لكل نوع سؤال (آية/حديث/تفسير/فقه/عقيدة/مصطلح/فتوى/منهج) + مستوى المحتوى A/B/C/D.
- ✅ **نظام الامتناع**: إذا لم توجد أدلة كافية يقول النظام "لم أجد في المصادر المحددة ما يكفي للإجابة بثقة" ولا يخمن.
- ✅ **تحليل منهج الكتاب**: 7 مواضيع قابلة للتحليل (التفسير/العقيدة/الإسرائيليات/الاستدلال/القراءات/المصادر/المعلومات)، كل استنتاج مربوط بأدلته.
- ✅ **عرض المصدر الأصلي**: عارض صفحات PDF مع رقم الصفحة + نص نظيف + تمييز المقطع.
- ✅ **شاشة الثقة**: "كيف توصلنا إلى هذه الإجابة؟" — السؤال → المصادر → المقاطع → الأدلة → التحليل → الإجابة (ليس Black Box).
- ✅ واجهة عربية RTL احترافية بـ IBM Plex Sans Arabic + Amiri، Dark Navy / Deep Blue، Light/Dark mode.
- ✅ Sticky footer برسالة الثقة.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js 16 App Router (RTL Arabic SPA, single / route)     │
│  ─────────────────────────────────────────────────────────  │
│  Components (src/components/naql/):                         │
│    AppShell · NavTabs · ThemeToggle                          │
│    HomeSection · LibrarySection · SearchSection              │
│    VerifySection · SourceViewer · AnalysisSection            │
│  State: Zustand store (src/lib/store.ts)                     │
│  API client: src/lib/api.ts (typed)                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  API Routes (src/app/api/*) — server-side only              │
│  ─────────────────────────────────────────────────────────  │
│  POST /api/library             → upload PDF                 │
│  GET  /api/library             → list user + official        │
│  GET  /api/library/[id]        → source detail + samples     │
│  DELETE /api/library/[id]      → delete source + chunks      │
│  POST /api/library/[id]/process → extract + chunk + index    │
│  GET  /api/library/[id]/page   → page text + chunk previews  │
│  POST /api/search              → RAG answer + evidence        │
│  POST /api/verify              → citation verification        │
│  POST /api/analyze             → book methodology analysis    │
│  GET  /api/stats               → trust panel counts          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  RAG Pipeline (src/lib/rag/)                                │
│  ─────────────────────────────────────────────────────────  │
│  arabic.ts    → normalization, tashkeel strip, PF→base,     │
│                 chunking, RTL-safe tokenize, highlight      │
│  pdf.ts       → Poppler `pdftotext` + pdfjs-dist fallback   │
│  policy.ts    → Source Policy Engine (classify + filter)    │
│  search.ts    → Hybrid Search (keyword TF + LLM rerank)     │
│  llm.ts       → ZAI client, RAG_SYSTEM_PROMPT, ragAnswer,  │
│                 validateClaims, rerankChunks, extractTags,  │
│                 analyzeBookMethodology, inferBookMeta        │
│  citation.ts  → verifyCitation (fuzzball + LCS word diff)   │
│  registry.ts  → OFFICIAL_REGISTRY + seedOfficialCatalog     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Storage Layer                                              │
│  ─────────────────────────────────────────────────────────  │
│  Prisma ORM + SQLite (db/custom.db)                         │
│  Models: User · Source · Chunk · SearchQuery · Citation ·  │
│          SourcePolicy · AnalysisReport                      │
│  File storage: /home/z/my-project/upload/                   │
│  Z.AI LLM via z-ai-web-dev-sdk (server-side only)           │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| Fonts | IBM Plex Sans Arabic (UI) + Amiri (classical/Quranic) |
| State | Zustand (client) + TanStack-ready API client |
| Database | Prisma ORM + SQLite (file-based, MVP) |
| PDF | Poppler `pdftotext` (primary) + pdfjs-dist (fallback) |
| Fuzzy match | fuzzball (token_set_ratio, partial_ratio) |
| LLM | Z.AI Web Dev SDK (chat.completions) — server-side only |
| Icons | Lucide React |
| Theme | next-themes (light/dark, default light) |

## Setup

### Prerequisites

- Node.js 20+ (or Bun 1.3+)
- `poppler-utils` package (for `pdftotext` and `pdfinfo`)
  - Debian/Ubuntu: `sudo apt install poppler-utils`
  - macOS: `brew install poppler`

### Installation

```bash
# Install dependencies
bun install

# Copy env file
cp .env.example .env

# Initialize the database
bun run db:push
```

### Running Locally

```bash
bun run dev
```

The app runs on `http://localhost:3000`. There is only ONE user-visible route (`/`). Everything else (library, search, verify, analysis, source viewer) is internal navigation within the SPA.

### Database Setup

Prisma is configured with SQLite. Schema is at `prisma/schema.prisma`. To push schema changes:

```bash
bun run db:push          # Apply schema (with data-loss acceptance)
bun run db:generate       # Regenerate Prisma Client
bun run db:migrate        # Create + apply migration
bun run db:reset          # Reset database (destructive)
```

The official sources catalog (Quran, Tabari, Bukhari, Muslim, Lisan al-Arab, Dorar, Shamela) is seeded automatically on first `GET /api/library` call.

## Source Policy Engine

A programmatic layer (`src/lib/rag/policy.ts`) — not just a prompt instruction.

| Question Type | Allowed Source Types | Level | Direct Answer |
|---|---|---|---|
| `ayah` (آية) | quran, tafsir | A | ✓ (must come from approved source) |
| `hadith` (حديث) | hadith | B | ✓ (must show grade) |
| `tafsir` (تفسير) | tafsir, quran | B | ✓ |
| `fiqh` (فقه) | fiqh | C | ✗ (show khilaf) |
| `aqeedah` (عقيدة) | aqeedah, tafsir, hadith | C | ✗ |
| `term` (مصطلح) | language | B | ✓ (must cite dictionary) |
| `fatwa` (فتوى شخصية) | — | D | ✗ (refer to specialist) |
| `methodology` (منهج) | all scholarly | B | ✓ (based on retrieved chunks only) |
| `biography` / `history` | history, general | A | ✓ |
| `general` | all | B | ✓ |

Classification uses Arabic-aware regex patterns (handles hamza variants, diacritics, Arabic-Indic digits).

## AI Safety

The system enforces source-grounding at multiple layers:

1. **Prompt-level** — `RAG_SYSTEM_PROMPT` instructs the model to use only the provided evidence, never fabricate, distinguish original text from analysis, abstain when evidence is insufficient, and avoid personal fatwa.
2. **Retrieval-level** — `hybridSearch` returns only chunks from policy-allowed sources.
3. **Validation-level** — `validateClaims` checks that every claim in the answer has evidence indices; mismatched/missing references are reported as `ValidationIssue`s in the UI ("تنبيهات التحقق").
4. **Citation-level** — `verifyCitation` compares user-submitted quotes against the actual source text via fuzzball + word-level LCS diff; match ratio is labeled as "مؤشر آلي أولي وليس حكمًا علميًا مستقلًا".
5. **Policy-level** — `filterSourcesByPolicy` removes disallowed sources BEFORE retrieval; for personal fatwa, the system explicitly states it cannot issue independent rulings.
6. **Transparency-level** — "كيف توصلنا إلى هذه الإجابة؟" panel shows the full pipeline (question → sources → chunks → evidence → analysis → answer) — no black box.

### What the system will NEVER do

- ❌ Fabricate an ayah, hadith, citation, page number, or source.
- ❌ Attribute a statement to an author who did not say it.
- ❌ Issue a personal fatwa.
- ❌ Use the LLM's internal knowledge as a substitute for source.
- ❌ Present model commentary as religious text.
- ❌ Present analysis as the author's words.

## Demo

### Demo Flow (the "WOW moment")

1. Open the platform → see hero + trust panel.
2. Click "أضف مصدرًا" → upload a PDF (e.g., `upload/sample_tabari_tafsir.pdf` — a 5-page Arabic sample about Tabari's methodology included in this repo).
3. System shows "جاري معالجة المصدر..." → completes indexing (status `مفهرس`).
4. Click "بحث" on the source card → search console opens with source pre-selected.
5. Ask: `ما منهج الإمام الطبري في التعامل مع الإسرائيليات؟`
6. See the answer:
   - Summary grounded in evidence.
   - 4 verified claims each linked to evidence `[1]`.
   - Confidence: عالية / Level: B.
   - Policy panel: نوع السؤال "منهج", notes.
   - "ما لا يفعله النظام" reminder.
   - 4 evidence cards with full Arabic text, page numbers, relevance scores.
   - "كيف توصلنا إلى هذه الإجابة؟" 6-step transparency panel.
7. Click an evidence card → opens the source viewer at the exact page with the chunk highlighted.
8. Go to "تحقق من اقتباس" → paste: `وكان منهجه في الإسرائيليات أن يذكرها أحيانا معلقة لا محققا لها ولا مبطلا`.
9. Select source → click "تحقق".
10. See:
    - Status: مطابق جزئيًا (amber).
    - Match ratio: 81% (with "مؤشر آلي أولي" notice).
    - Side-by-side comparison: input vs. original.
    - Colored diff (add/remove/change).
    - "فتح الصفحة الأصلية" button.

### Sample Source

A 5-page Arabic PDF sample (`upload/sample_tabari_tafsir.pdf`) is included. It was generated with WeasyPrint using the Amiri font and covers:
- مقدمة المؤلف
- باب القول فيما جاء في الإسرائيليات من الروايات
- منهج الإمام الطبري في التفسير
- باب القول في القراءات
- خاتمة

## Limitations (MVP)

- **OCR**: PDFs that are pure images (scanned) require OCR. The MVP detects this and shows "تعذّر استخراج النص - قد يكون PDF مصورًا ويتطلب OCR" — true OCR pipeline is not included.
- **No real-time streaming**: answers are returned as a single JSON response (not streamed).
- **Chapter detection**: Heuristic regex only; most PDFs will have `chapter=null`. The page number is always preserved.
- **Tag extraction**: Capped at 30 longest chunks per source to control LLM cost/latency. Keyword search still works on raw text.
- **Embeddings**: No dedicated embedding API in the SDK; we use keyword TF + LLM rerank instead. Future: integrate an Arabic embedding model.
- **Pre-loaded official sources**: Official catalog is metadata-only (no PDFs attached). Users must upload their own copies of books to search inside them.
- **Rate limits**: Z.AI API may rate-limit during heavy indexing (many parallel `extractTags` calls). The system gracefully degrades — chunks without tags still match via keyword search.

## Future Work

Not in scope for the hackathon MVP, but designed for:

- Pre-loading approved sources (Quran text, Hadith collections) as actual indexed content.
- Real Arabic embedding model for true vector semantic search.
- Streaming answers (SSE) for faster perceived response.
- OCR pipeline (Tesseract Arabic) for scanned PDFs.
- Multi-source comparison view.
- Saved searches + export citation (BibTeX/Chicago).
- Account system (currently guest mode; `User` model exists in schema).

## Deployment

The app is designed to run on a single host with Caddy as the gateway (see `Caddyfile`). For production:

1. Set `DATABASE_URL` to a persistent SQLite path (or migrate to PostgreSQL by changing the `datasource` provider).
2. Ensure `poppler-utils` is installed on the host.
3. Run `bun run build` (note: in this dev sandbox we use `bun run dev`).
4. Configure the upload directory to be a persistent volume.
5. Set rate-limit and authentication policies on the Z.AI SDK usage.

## Project Structure

```
src/
├── app/
│   ├── api/                     # All API routes (server-only)
│   │   ├── library/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       ├── page/route.ts
│   │   │       └── process/route.ts
│   │   ├── search/route.ts
│   │   ├── verify/route.ts
│   │   ├── analyze/route.ts
│   │   └── stats/route.ts
│   ├── globals.css              # Dark Navy theme + RTL + Arabic font + diff styles
│   ├── layout.tsx               # RTL, IBM Plex Sans Arabic + Amiri, ThemeProvider
│   └── page.tsx                 # SPA root (single visible route)
├── components/
│   ├── naql/                    # App-specific components
│   │   ├── AppShell.tsx
│   │   ├── NavTabs.tsx
│   │   ├── ThemeToggle.tsx
│   │   ├── HomeSection.tsx
│   │   ├── LibrarySection.tsx
│   │   ├── SearchSection.tsx
│   │   ├── VerifySection.tsx
│   │   ├── SourceViewer.tsx
│   │   ├── AnalysisSection.tsx
│   │   ├── labels.ts
│   │   └── viewer-store.ts
│   └── ui/                      # shadcn/ui components (pre-installed)
├── lib/
│   ├── api.ts                   # Typed frontend API client
│   ├── store.ts                 # Zustand SPA store
│   ├── db.ts                    # Prisma client singleton
│   └── rag/
│       ├── arabic.ts            # Arabic text normalization + chunking + diff
│       ├── pdf.ts               # Poppler + pdfjs-dist extraction
│       ├── policy.ts            # Source Policy Engine
│       ├── search.ts            # Hybrid Search (keyword + LLM rerank)
│       ├── llm.ts               # Z.AI SDK + RAG prompts + Citation Validator
│       ├── citation.ts          # Citation verification + word-level diff
│       └── registry.ts          # Official source catalog
└── types/
    └── fuzzball.d.ts            # Type shim for fuzzball
prisma/
└── schema.prisma                # User · Source · Chunk · SearchQuery · Citation · SourcePolicy · AnalysisReport
upload/                          # User-uploaded PDFs
public/fonts/                    # Amiri font for sample PDF generation
```

## License

MIT — this is a hackathon MVP. Use at your own risk. The platform is a research aid, not a fatwa-issuing authority.

---

> "نقل محقق لا يستبدل الباحث؛ بل يساعده على الوصول إلى الدليل والتحقق منه."
> "لم نجد مرجعًا كافيًا في المصادر المتاحة، لذلك لن نخمن."
