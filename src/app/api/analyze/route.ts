/**
 * Book analysis API
 * POST /api/analyze
 * Body: { sourceId, topic }
 *
 * topic: methodology | israiliyyat | aqeedah | tafsir_method |
 *       qiraat_method | istidlal_method | sources_used
 *
 * Pipeline: hybridSearch(topicQuery, [sourceId]) -> toEvidence -> analyzeBookMethodology
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hybridSearch, toEvidence } from '@/lib/rag/search'
import { analyzeBookMethodology } from '@/lib/rag/llm'
import { logMissingSource, logEmptySearch } from '@/lib/rag/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const VALID_TOPICS = new Set([
  'methodology',
  'israiliyyat',
  'aqeedah',
  'tafsir_method',
  'qiraat_method',
  'istidlal_method',
  'sources_used',
])

const TOPIC_QUERIES: Record<string, string> = {
  methodology: 'منهج المؤلف في الكتاب وطريقته في التأليف',
  israiliyyat: 'الإسرائيليات روايات بني إسرائيل وقصصهم',
  aqeedah: 'عقيدة المؤلف توحيد صفات الله إيمان',
  tafsir_method: 'طريقة المؤلف في التفسير ومعاني الآيات',
  qiraat_method: 'القراءات والروايات في التلاوة',
  istidlal_method: 'طريقة الاستدلال والحجج والأدلة',
  sources_used: 'المصادر والكتب والمراجع التي يعتمد عليها المؤلف',
}

const TOPIC_LABELS: Record<string, string> = {
  methodology: 'منهج المؤلف',
  israiliyyat: 'الإسرائيليات',
  aqeedah: 'العقيدة',
  tafsir_method: 'منهج التفسير',
  qiraat_method: 'القراءات',
  istidlal_method: 'منهج الاستدلال',
  sources_used: 'المصادر المعتمدة',
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 })
    }

    const sourceId = String(body.sourceId || '').trim()
    const topic = String(body.topic || '').trim()

    if (!sourceId) {
      return NextResponse.json(
        { error: 'حدد المصدر لتحليله.' },
        { status: 400 }
      )
    }
    if (!VALID_TOPICS.has(topic)) {
      return NextResponse.json(
        { error: 'موضوع التحليل غير معروف.' },
        { status: 400 }
      )
    }

    const source = await db.source.findUnique({
      where: { id: sourceId },
      select: { id: true, title: true, status: true },
    })
    if (!source) {
      logMissingSource({ route: '/api/analyze', sourceId })
      return NextResponse.json({ error: 'المصدر غير موجود.' }, { status: 404 })
    }

    const topicQuery = TOPIC_QUERIES[topic]
    const topicLabel = TOPIC_LABELS[topic]

    const scoredChunks = await hybridSearch(topicQuery, [sourceId], {
      mode: 'hybrid',
      topK: 10,
    })

    if (scoredChunks.length === 0) {
      logEmptySearch({
        route: '/api/analyze',
        question: topicQuery,
        sourceIds: [sourceId],
        chunkCount: 0,
      })
      const emptyAnalysis = {
        topic: topicLabel,
        summary:
          'لا توجد مقاطع كافية في المصدر لإجراء التحليل. تأكد من فهرسة المصدر أو جرّب موضوعًا آخر.',
        findings: [],
        confidence: 'low' as const,
      }
      try {
        await db.analysisReport.create({
          data: {
            sourceId,
            topic,
            summary: emptyAnalysis.summary,
            evidenceIds: '',
            claimCount: 0,
          },
        })
      } catch {
        /* ignore */
      }
      return NextResponse.json({
        analysis: emptyAnalysis,
        evidence: [],
        chunkIds: [],
      })
    }

    const evidence = scoredChunks.map(toEvidence)
    const chunkIds = scoredChunks.map((c) => c.id)

    const analysis = await analyzeBookMethodology(topicLabel, evidence)

    // Persist report
    try {
      await db.analysisReport.create({
        data: {
          sourceId,
          topic,
          summary: analysis.summary,
          evidenceIds: chunkIds.join(','),
          claimCount: Array.isArray(analysis.findings) ? analysis.findings.length : 0,
        },
      })
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      analysis,
      evidence,
      chunkIds,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'تعذّر تحليل المصدر.', detail: String(err?.message || err) },
      { status: 500 }
    )
  }
}
