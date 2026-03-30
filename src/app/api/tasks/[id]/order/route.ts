import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { updateTaskOrder } from "@/lib/services/tasks.service";
import type { TaskStatus } from "@/lib/supabase/types";

// PATCH /api/tasks/[id]/order
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const result = await updateTaskOrder(
    supabase,
    id,
    user!.id,
    body.newOrder,
    body.status as TaskStatus,
  );
  return NextResponse.json(result);
}
