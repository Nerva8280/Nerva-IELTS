import "server-only";
import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { cookies } from "next/headers";

const COOKIE = "ic_session";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export interface SessionUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function verifyGoogleCredential(credential: string): Promise<SessionUser> {
  const { payload } = await jwtVerify(credential, googleKeys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  });
  if (!payload.email || payload.email_verified !== true) throw new Error("email not verified");
  return {
    sub: String(payload.sub),
    email: String(payload.email),
    name: String(payload.name ?? payload.email),
    picture: payload.picture ? String(payload.picture) : undefined,
  };
}

export function emailAllowed(email: string) {
  const list = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.length === 0 || list.includes(email.toLowerCase());
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !process.env.SESSION_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { sub: String(payload.sub), email: String(payload.email), name: String(payload.name), picture: payload.picture as string | undefined };
  } catch {
    return null;
  }
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
