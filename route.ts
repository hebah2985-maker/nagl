/**
 * Citation verification API
 * POST /api/verify
 * Body: { quotedText, sourceId }
 *
 * Verifies a user-submitted quote against the indexed text of a source.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyCitation } from '@/lib/rag/citation'
import { logMissingSource } from '@/lib/rag/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 })
    }

    const quotedText = String(body.quotedText || '').trim()
    const sourceId = String(body.sourceId || '').trim()

    if (quotedText.length < 3) {
      return NextResponse.json(
        { error: 'النص المدخل قصير جدًا للتحقق منه.' },
        { status: 400 }
      )
    }
    if (!sourceId) {
      return NextResponse.json(
        { error: 'حدد المصدر للتحقق منه.' },
        { status: 400 }
      )
    }

    // Make sure the source exists
    const source = await db.source.findUnique({
      where: { id: sourceId },
      select: { id: true, title: true },
    })
    if (!source) {
      logMissingSource({ route: '/api/verify', sourceId })
      return NextResponse.json({ error: 'المصدر غير موجود.' }, { status: 404 })
    }

    const result = await verifyCitation(quotedText, sourceId)

    // Persist Citation row
    try {
      await db.citation.create({
        data: {
          quotedText,
          sourceId,
          status: result.status,
          matchRatio: result.matchRatio,
          matchedChunkId: result.matchedChunkId,
          matchedText: result.matchedText,
          matchedPage: result.matchedPage,
          differences: JSON.stringify(result.differences),
          isExactMatch: result.isExactMatch,
          note: result.note,
        },
      })
    } catch {
      // best-effort persistence
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json(
      { error: 'تعذّر التحقق من الاقتباس.', detail: String(err?.message || err) },
      { status: 500 }
    )
  }
}
