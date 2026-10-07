/**
 * Current user info route.
 * Returns the logged-in user's id/email/name/role, or 401 if not logged in.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ user: null }, { status: 200 })
  }
  const u = session.user as any
  return NextResponse.json({
    user: {
      id: u.id || null,
      email: u.email || null,
      name: u.name || null,
      role: u.role || 'user',
    },
  })
}
