import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import {
  findOneSession,
  updateSession,
  removeSession,
} from "@/lib/services/focus-sessions.service";

// GET /api/focus-sessions/[id]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const { id } = await params;
  const session = await findOneSession(supabase, id, user!.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json(session);
}

// PATCH /api/focus-sessions/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const session = await updateSession(supabase, id, user!.id, body);
  return NextResponse.json(session);
}

// DELETE /api/focus-sessions/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const { id } = await params;
  const session = await removeSession(supabase, id, user!.id);
  return NextResponse.json(session);
}
