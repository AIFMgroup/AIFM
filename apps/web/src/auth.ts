export const runtime = 'nodejs';
import NextAuth from 'next-auth';
import CognitoProvider from 'next-auth/providers/cognito';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// Mock users for development/demo - replace with AWS Cognito or DynamoDB in production
const MOCK_USERS = [
  {
    id: '1',
    email: 'admin@aifm.se',
    name: 'Admin User',
    password: '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u', // "password"
    role: 'ADMIN',
    image: null,
  },
  {
    id: '2',
    email: 'coordinator@aifm.se',
    name: 'Coordinator User',
    password: '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u', // "password"
    role: 'COORDINATOR',
    image: null,
  },
  {
    id: '3',
    email: 'specialist@aifm.se',
    name: 'Specialist User',
    password: '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u', // "password"
    role: 'SPECIALIST',
    image: null,
  },
  {
    id: '4',
    email: 'client@aifm.se',
    name: 'Client User',
    password: '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u', // "password"
    role: 'CLIENT',
    image: null,
  },
  {
    id: '5',
    email: 'edwin.sjogren@aifm.se',
    name: 'Edwin Sjögren',
    password: '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u', // "password"
    role: 'ADMIN',
    image: null,
  },
];

const cognitoIssuer =
  process.env.COGNITO_REGION && process.env.COGNITO_USER_POOL_ID
    ? `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`
    : undefined;

const providers = [
  ...(process.env.COGNITO_CLIENT_ID &&
  process.env.COGNITO_CLIENT_SECRET &&
  cognitoIssuer
    ? [
        CognitoProvider({
          clientId: process.env.COGNITO_CLIENT_ID,
          clientSecret: process.env.COGNITO_CLIENT_SECRET,
          issuer: cognitoIssuer,
        }),
      ]
    : []),
  CredentialsProvider({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      // Find user in mock users
      const user = MOCK_USERS.find(u => u.email === credentials.email);

      if (!user || !user.password) {
        return null;
      }

      const isPasswordValid = await bcrypt.compare(
        credentials.password as string,
        user.password
      );

      if (!isPasswordValid) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      };
    },
  }),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers,
  pages: {
    signIn: '/sign-in',
    error: '/sign-in',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});
