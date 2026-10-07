/**
 * Sign-up route: register a new user with email + password.
 * Body: { email, password, name? }
 * Returns: { ok: true } on success.
 */
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const name = String(body?.name || '').trim()

    // Validation
    if (!email) {
      return NextResponse.json({ error: 'البريد الإلكتروني مطلوب.' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'صيغة البريد الإلكتروني غير صحيحة.' },
        { status: 400 }
      )
    }
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' },
        { status: 400 }
      )
    }
    if (password.length > 128) {
      return NextResponse.json(
        { error: 'كلمة المرور طويلة جدًا (الحد 128 حرفًا).' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'هذا البريد الإلكتروني مسجّل بالفعل. سجّل الدخول بدلًا من ذلك.' },
        { status: 409 }
      )
    }

    // Hash + create
    const passwordHash = await bcrypt.hash(password, 10)
    await db.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
        role: 'user',
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'تعذّر إنشاء الحساب.', detail: String(err?.message || err) },
      { status: 500 }
    )
  }
}
