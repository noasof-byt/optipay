/**
 * Auth middleware helpers for API routes.
 *
 * Full JWT validation is implemented in Step 4 alongside the auth API routes.
 * This file provides the ADMIN guard used by admin endpoints.
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
 * Validate the Bearer token from the Authorization header.
 * Returns the decoded payload or null if invalid/missing.
 */
export function verifyToken(req: NextRequest): AuthPayload | null {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice(7);
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

/**
 * Guard: ensures the caller is authenticated.
 * Returns a 401 NextResponse if not, null if OK.
 */
export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  const payload = verifyToken(req);
  if (!payload) {
    return NextResponse.json({ message: "לא מורשה" }, { status: 401 });
  }

  // Check the user is not locked or deleted
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
 * Guard: ensures the caller is an admin.
 * Returns a 403 NextResponse if not, null if OK.
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
 * Extract and verify token from request, returning the userId.
 * Throws if invalid — use inside try/catch or after requireAuth().
 */
export function getUserId(req: NextRequest): string {
  const payload = verifyToken(req);
  if (!payload) throw new Error("Unauthorized");
  return payload.userId;
}
