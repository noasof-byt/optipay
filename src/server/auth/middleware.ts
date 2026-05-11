/**
 * Auth middleware helpers for API routes.
 *
 * Token resolution order (both patterns are supported):
 *   1. httpOnly cookie "optipay_token"  — set by /api/auth/login|register
 *   2. Authorization: Bearer <token>    — sent by client-side fetch calls
 */
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET!;

export interface AuthPayload {
  userId: string;
  role:   string;
  email:  string;
}

/**
 * Extract and validate the JWT from the request.
 * Checks httpOnly cookie first, then Authorization header.
 * Returns the decoded payload or null if invalid/missing.
 */
export function verifyToken(req: NextRequest): AuthPayload | null {
  // 1. httpOnly cookie (browser requests)
  const cookieToken = req.cookies.get("optipay_token")?.value;
  if (cookieToken) {
    try {
      return jwt.verify(cookieToken, JWT_SECRET) as AuthPayload;
    } catch {
      // Fall through to Bearer
    }
  }

  // 2. Authorization: Bearer (programmatic / localStorage-based clients)
  const header = req.headers.get("Authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    try {
      return jwt.verify(token, JWT_SECRET) as AuthPayload;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Guard: ensures caller is authenticated and account is active.
 * Returns a 401/403 NextResponse on failure, null on success.
 */
export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  const payload = verifyToken(req);
  if (!payload) {
    return NextResponse.json({ message: "לא מורשה" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where:  { id: payload.userId },
    select: { isLocked: true, isDeleted: true },
  });

  if (!user || user.isDeleted || user.isLocked) {
    return NextResponse.json({ message: "הגישה נחסמה" }, { status: 403 });
  }

  return null;
}

/**
 * Guard: requires ADMIN role.
 */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const payload = verifyToken(req);
  if (!payload) {
    return NextResponse.json({ message: "לא מורשה" }, { status: 401 });
  }
  if (payload.role !== "ADMIN") {
    return NextResponse.json({ message: "נדרשות הרשאות מנהל" }, { status: 403 });
  }
  return null;
}

/**
 * Extract userId from a verified token.
 * Must be called after requireAuth() to guarantee validity.
 */
export function getUserId(req: NextRequest): string {
  const payload = verifyToken(req);
  if (!payload) throw new Error("Unauthorized");
  return payload.userId;
}
