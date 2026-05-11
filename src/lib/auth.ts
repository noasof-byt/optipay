/**
 * Authentication utilities — server-side only.
 * Never import this file in client components.
 */
import "server-only";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const SECRET      = process.env.JWT_SECRET!;
const EXPIRES_IN  = process.env.JWT_EXPIRES_IN ?? "7d";
const SALT_ROUNDS = 12;

if (!SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

export interface JwtPayload {
  userId: string;
  email:  string;
  role:   string;
}

// ── Token ─────────────────────────────────────────────────────────────────────

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}

// ── Password ──────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
