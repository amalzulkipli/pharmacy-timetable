import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import type { NextAuthConfig } from 'next-auth';

const authConfig: NextAuthConfig = {
  trustHost: true,
  basePath: '/timetable/api/auth',
  providers: [
    Credentials({
      name: 'Admin Login',
      credentials: {
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const hashBase64 = process.env.ADMIN_PASSWORD_HASH;

        // Decode base64 to get the actual bcrypt hash
        // (Base64 encoding avoids $ character issues in .env parsing)
        const hash = hashBase64
          ? Buffer.from(hashBase64, 'base64').toString('utf-8')
          : null;

        if (!hash) {
          console.error('ADMIN_PASSWORD_HASH environment variable is not set');
          return null;
        }

        if (!credentials?.password || typeof credentials.password !== 'string') {
          return null;
        }

        try {
          const isValid = await bcrypt.compare(credentials.password, hash);

          if (isValid) {
            return {
              id: 'admin',
              name: 'Admin',
              role: 'admin',
            };
          }
        } catch (error) {
          console.error('Auth error:', error);
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

// Helper to generate password hash (run once to create the hash)
export async function generatePasswordHash(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
