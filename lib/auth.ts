/**
 * NextAuth.js v4 configuration for Naql Muhaqqiq.
 * Uses the Credentials provider with email + password (bcrypt-hashed).
 * Sessions are JWT-based (no database sessions needed for the MVP).
 */
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  // We don't persist sessions to the DB — JWT is enough for the MVP.
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'البريد الإلكتروني وكلمة المرور',
      credentials: {
        email: { label: 'البريد الإلكتروني', type: 'email' },
        password: { label: 'كلمة المرور', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password || ''
        if (!email || !password) {
          throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور.')
        }
        // Basic email shape validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error('صيغة البريد الإلكتروني غير صحيحة.')
        }
        if (password.length < 6) {
          throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل.')
        }

        const user = await db.user.findUnique({ where: { email } })
        if (!user || !user.passwordHash) {
          throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.')
        }
        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) {
          throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.')
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role || 'user'
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id
        ;(session.user as any).role = token.role
      }
      return session
    },
  },
  pages: {
    // We use a custom dialog in the SPA, not a separate page. NextAuth will
    // fall back to its default sign-in page only if a route is hit directly.
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET || 'naql-muhaqqiq-dev-secret-change-in-prod',
  cookies: {
    // Production-like cookie settings. In dev (http), `Secure` is auto-disabled
    // by NextAuth when the request isn't HTTPS; in prod over HTTPS the cookies
    // are marked Secure so they aren't stripped by the browser. SameSite=Lax
    // allows the cookie to be sent on same-site navigations and top-level
    // cross-site GETs (which is what we need for the SPA), while blocking
    // cross-site POST/PUT in iframes (CSRF protection).
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: undefined,
      },
    },
    callbackUrl: {
      name: 'next-auth.callback-url',
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
}
