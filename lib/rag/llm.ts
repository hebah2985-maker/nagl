/**
 * LLM client wrapping z-ai-web-dev-sdk for the Naql Muhaqqiq platform.
 * Server-side ONLY. All RAG prompts live here.
 */
import ZAI from 'z-ai-web-dev-sdk'
import { withRateLimit, mapWithRateLimit } from './rate-limit'

let _zai: any = null
export async function getClient() {
  if (_zai) return _zai
  _zai = await ZAI.create()
  return _zai
}

// System prompt that enforces source-grounding
export const RAG_SYSTEM_PROMPT = `أنت "نقل محقق"، مساعد بحث وتوثيق في المصادر الشرعية. لست مصدرًا مستقلًا للمعلومات الشرعية.

مبادئك الصارمة:
1. استخدم الأدلة المقدمة فقط ولا تضف معلومة شرعية غير مدعومة بالأدلة.
2. لا تخترع نصًا أو حديثًا أو آية أو مصدرًا أو رقم صفحة.
3. فرّق بوضوح بين النص الأصلي والتحليل. لا تعرض الاستنتاج على أنه كلام المؤلف.
4. إذا لم تكن الأدلة كافية، صرّح بعدم كفايتها ولا تخمن.
5. كل ادعاء (claim) في إجابتك يجب أن يرتبط بدليل: [source_id, page, chunk].
6. عند وجود اختلاف أو خلاف، لا تعرض نتيجة قطعية دون أساس.
7. في مسائل الفتوى الشخصية، لا تقدم حكمًا مستقلًا، وأحِل المستخدم إلى مختص.
8. لا تعرض شرح النموذج على أنه نص شرعي، ولا الاستنتاج على أنه كلام المؤلف.
9. الأولوية للدقة والتتبع على اكتمال الإجابة.

صيغة الإجابة المطلوبة (JSON صارم):
{
  "summary": "خلاصة قصيرة مبنية على الأدلة",
  "claims": [
    {
      "text": "نص الادعاء",
      "evidence": [0, 1]   // فهارس الأدلة المقدمة (indices)
    }
  ],
  "quotes": [
    {
      "text": "اقتباس حرفي من المصدر",
      "evidence_index": 0
    }
  ],
  "confidence": "high|medium|low|insufficient",
  "abstain": false,
  "abstain_reason": null,
  "level": "A|B|C|D",
  "notes": "ملاحظات التحقق: ما الذي تم التحقق منه، وأين توجد المخاطر"
}

إذا لم توجد أدلة كافية: abstain=true، abstain_reason="لم أجد في المصادر المحددة ما يكفي للإجابة بثقة."، confidence="insufficient".
لا تُضِيف معلومات من معرفتك العامة في أي حال.`

export interface Evidence {
  id: string
  sourceId: string
  sourceTitle: string
  author: string | null
  edition: string | null
  pageNumber: number
  chapter: string | null
  section: string | null
  text: string
  score: number
  keywords?: string[]
}

export interface RagAnswer {
  summary: string
  claims: Array<{ text: string; evidence: number[] }>
  quotes: Array<{ text: string; evidence_index: number }>
  confidence: 'high' | 'medium' | 'low' | 'insufficient'
  abstain: boolean
  abstain_reason: string | null
  level: 'A' | 'B' | 'C' | 'D'
  notes: string
}

function buildEvidenceBlock(evidence: Evidence[]): string {
  return evidence
    .map(
      (e, i) =>
        `[دليل ${i}] source_id=${e.sourceId} | المصدر="${e.sourceTitle}" | المؤلف=${e.author || 'غير معروف'} | الطبعة=${e.edition || 'غير محددة'} | ص=${e.pageNumber} | الفصل=${e.chapter || 'غير محدد'} | القسم=${e.section || 'غير محدد'}\nالنص الأصلي:\n${e.text}`
    )
    .join('\n\n---\n\n')
}

export async function ragAnswer(
  question: string,
  evidence: Evidence[],
  policyContext: string
): Promise<RagAnswer> {
  const zai = await getClient()

  if (evidence.length === 0) {
    return {
      summary: 'لم أجد في المصادر المحددة ما يكفي للإجابة بثقة.',
      claims: [],
      quotes: [],
      confidence: 'insufficient',
      abstain: true,
      abstain_reason: 'لم أجد في المصادر المحددة ما يكفي للإجابة بثقة.',
      level: 'B',
      notes: 'لم يتم العثور على أدلة كافية. يُنصح بصياغة سؤال آخر أو إضافة مصادر إضافية.',
    }
  }

  const evidenceBlock = buildEvidenceBlock(evidence)
  const userPrompt = `سؤال المستخدم:
${question}

سياسة المصدر:
${policyContext}

الأدلة المسترجعة (المصدر الوحيد المسموح به للإجابة):
${evidenceBlock}

عدد الأدلة المتاحة: ${evidence.length}

تذكير: لا تُضِف أي معلومة غير موجودة في الأدلة أعلاه. أجب بصيغة JSON فقط بدون أي شرح إضافي.`

  try {
    const completion = await withRateLimit(() =>
      zai.chat.completions.create({
        messages: [
          { role: 'system', content: RAG_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        thinking: { type: 'disabled' },
      })
    )
    const raw = completion.choices?.[0]?.message?.content || ''
    return parseRagResponse(raw, evidence)
  } catch (err: any) {
    const is429 = /429|Too many requests/i.test(String(err?.message || err))
    return {
      summary: is429
        ? 'النظام مشغول الآن بسبب ضغط على خدمة الذكاء الاصطناعي. يرجى المحاولة بعد لحظات.'
        : 'تعذّر توليد الإجابة من النموذج. حاول مرة أخرى.',
      claims: [],
      quotes: [],
      confidence: 'low',
      abstain: true,
      abstain_reason: is429
        ? 'تجاوزنا حد المعدل مؤقتًا في خدمة الذكاء الاصطناعي. حاول مرة أخرى بعد لحظات.'
        : 'خطأ تقني في النموذج.',
      level: 'B',
      notes: String(err?.message || err),
    }
  }
}

function parseRagResponse(raw: string, evidence: Evidence[]): RagAnswer {
  // Find first { ... } JSON block (sometimes models wrap with ```json)
  let jsonStr = raw.trim()
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch) jsonStr = fenceMatch[1].trim()
  const firstBrace = jsonStr.indexOf('{')
  const lastBrace = jsonStr.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)
  }
  try {
    const parsed = JSON.parse(jsonStr)
    return {
      summary: String(parsed.summary || ''),
      claims: Array.isArray(parsed.claims) ? parsed.claims : [],
      quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
      confidence: parsed.confidence || 'low',
      abstain: Boolean(parsed.abstain),
      abstain_reason: parsed.abstain_reason || null,
      level: parsed.level || 'B',
      notes: String(parsed.notes || ''),
    }
  } catch {
    // Fallback: treat as plain text summary
    return {
      summary: raw.trim().slice(0, 2000),
      claims: [],
      quotes: [],
      confidence: 'low',
      abstain: false,
      abstain_reason: null,
      level: 'B',
      notes: 'تعذّر تحليل استجابة النموذج كـ JSON.',
    }
  }
}

// Citation Validator: verify the LLM answer's claims against evidence
export interface ValidationIssue {
  type: 'unsupported_claim' | 'missing_evidence' | 'evidence_mismatch'
  claimIndex: number
  detail: string
}

export function validateClaims(answer: RagAnswer, evidence: Evidence[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (answer.abstain) return issues

  answer.claims.forEach((claim, i) => {
    if (!claim.evidence || claim.evidence.length === 0) {
      issues.push({
        type: 'missing_evidence',
        claimIndex: i,
        detail: `الادعاء #${i + 1} غير مرتبط بأي دليل.`,
      })
      return
    }
    // Verify referenced evidence indices exist
    for (const idx of claim.evidence) {
      if (idx < 0 || idx >= evidence.length) {
        issues.push({
          type: 'evidence_mismatch',
          claimIndex: i,
          detail: `الادعاء #${i + 1} يشير إلى دليل غير موجود: [${idx}].`,
        })
      }
    }
  })

  return issues
}

// Extract semantic tags from a chunk of text using LLM (lightweight).
// NOTE: wrapped in withRateLimit so it survives 429 bursts.
export async function extractTags(text: string): Promise<string[]> {
  const zai = await getClient()
  try {
    const completion = await withRateLimit(() =>
      zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'أنت مساعد يستخرج 3-6 كلمات مفتاحية دلالية من نص عربي شرعي. أعد فقط الكلمات مفصولة بفواصل، بدون أي شرح.',
          },
          {
            role: 'user',
            content: text.slice(0, 1800),
          },
        ],
        thinking: { type: 'disabled' },
      })
    )
    const raw = String(completion.choices?.[0]?.message?.content || '').trim()
    return raw
      .split(/[,،\n]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1 && t.length < 40)
      .slice(0, 6)
  } catch {
    return []
  }
}

/**
 * Batch-extract tags for many chunks with bounded concurrency.
 * Use this instead of `Promise.all(chunks.map(extractTags))` to avoid 429s.
 * Default concurrency=2 to stay well under the Z.AI rate limit.
 */
export async function extractTagsBatch(
  texts: string[],
  concurrency = 2
): Promise<string[][]> {
  return mapWithRateLimit(
    texts,
    async (t) => {
      try {
        return await extractTags(t)
      } catch {
        return []
      }
    },
    concurrency
  )
}

// Lightweight topic-based semantic scoring: ask the LLM to rate the relevance
// of each candidate chunk to the query. We pass top-N keyword hits to save tokens.
export async function rerankChunks(
  question: string,
  candidates: Array<{ id: string; text: string; pageNumber: number; sourceTitle: string }>,
  topK = 6
): Promise<Array<{ id: string; score: number }>> {
  const zai = await getClient()
  if (candidates.length === 0) return []
  if (candidates.length === 1) return [{ id: candidates[0].id, score: 0.9 }]

  const limited = candidates.slice(0, 15) // protect token budget
  const ctx = limited
    .map(
      (c, i) =>
        `#${i} [ص=${c.pageNumber}, مصدر=${c.sourceTitle}]: ${c.text.slice(0, 350)}`
    )
    .join('\n\n')

  const userPrompt = `السؤال: ${question}

المقاطع المرشحة:
${ctx}

أعد قائمة بأفضل ${topK} مقاطع حسب الصلة الدلالية للسؤال، بصيغة JSON فقط:
{"scores":[{"index":0,"score":0.95}]}
الدرجة بين 0 و 1. لا تكتب أي شيء خارج JSON.`

  try {
    const completion = await withRateLimit(() =>
      zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'أنت مُرتِّب مقاطع نصية عربية للبحث الدلالي. أعد JSON فقط.',
          },
          { role: 'user', content: userPrompt },
        ],
        thinking: { type: 'disabled' },
      })
    )
    const raw = String(completion.choices?.[0]?.message?.content || '').trim()
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return limited.slice(0, topK).map((c) => ({ id: c.id, score: 0.5 }))
    const parsed = JSON.parse(m[0])
    const arr = Array.isArray(parsed.scores) ? parsed.scores : []
    const out: Array<{ id: string; score: number }> = []
    for (const item of arr) {
      const idx = Number(item.index)
      const sc = Math.max(0, Math.min(1, Number(item.score) || 0))
      if (idx >= 0 && idx < limited.length) {
        out.push({ id: limited[idx].id, score: sc })
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, topK)
  } catch {
    return limited.slice(0, topK).map((c) => ({ id: c.id, score: 0.5 }))
  }
}

// Book analysis (methodology)
export interface BookAnalysisResult {
  topic: string
  summary: string
  findings: Array<{ text: string; chunkIds: string[] }>
  confidence: 'high' | 'medium' | 'low'
}

export async function analyzeBookMethodology(
  topic: string,
  evidence: Evidence[]
): Promise<BookAnalysisResult> {
  const zai = await getClient()
  if (evidence.length === 0) {
    return {
      topic,
      summary: 'لا توجد أدلة كافية في المصدر لإجراء التحليل.',
      findings: [],
      confidence: 'low',
    }
  }
  const evidenceBlock = buildEvidenceBlock(evidence)
  const userPrompt = `موضوع التحليل: ${topic}

المقاطع المسترجعة من الكتاب:
${evidenceBlock}

أنت تحلل "منهج المؤلف" في هذا الموضوع بناءً على المقاطع فقط. لا تخترع.
أعد JSON فقط:
{
  "topic": "${topic}",
  "summary": "خلاصة تحليلية قصيرة مبينة على الأدلة",
  "findings": [
    {"text": "الاستنتاج (مثلاً: يعرض الإسرائيليات دون تصحيح)", "chunkIds": [0, 1]}
  ],
  "confidence": "high|medium|low"
}
كل استنتاج يجب أن يشير إلى فهارس الأدلة (indices من 0). لا تستخدم معرفتك العامة عن المؤلف.`

  try {
    const completion = await withRateLimit(() =>
      zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'أنت محلل منهج علمي للكتب الشرعية. تبني الاستنتاجات على مقاطع مسترجعة فقط. لا تخترع. أعد JSON فقط.',
          },
          { role: 'user', content: userPrompt },
        ],
        thinking: { type: 'disabled' },
      })
    )
    const raw = String(completion.choices?.[0]?.message?.content || '').trim()
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) {
      return { topic, summary: raw.slice(0, 1500), findings: [], confidence: 'low' as const }
    }
    const parsed = JSON.parse(m[0])
    return {
      topic: parsed.topic || topic,
      summary: String(parsed.summary || ''),
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      confidence: parsed.confidence || 'low',
    }
  } catch (err: any) {
    const is429 = /429|Too many requests/i.test(String(err?.message || err))
    return {
      topic,
      summary: is429
        ? 'تعذّر التحليل مؤقتًا بسبب ضغط على خدمة الذكاء الاصطناعي. حاول مرة أخرى بعد لحظات.'
        : 'تعذّر التحليل. ' + String(err?.message || err),
      findings: [],
      confidence: 'low',
    }
  }
}

// Quick metadata inference from extracted first pages
export async function inferBookMeta(firstPagesText: string, fileName: string) {
  const zai = await getClient()
  try {
    const completion = await withRateLimit(() =>
      zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'أنت مساعد يستخرج بيانات تعريفية لكتاب عربي شرعي من أول صفحاته. أعد JSON فقط: {"title":"...","author":"...","sourceType":"tafsir|hadith|fiqh|aqeedah|language|history|general","edition":"...","publisher":"...","year":null}. اترك الحقل null إذا لم تجد.',
          },
          {
            role: 'user',
            content: `اسم الملف: ${fileName}\n\nنص أول الصفحات:\n${firstPagesText.slice(0, 2500)}`,
          },
        ],
        thinking: { type: 'disabled' },
      })
    )
    const raw = String(completion.choices?.[0]?.message?.content || '').trim()
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return null
    return JSON.parse(m[0])
  } catch {
    return null
  }
}
