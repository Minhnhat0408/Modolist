import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { createServiceClient } from "@/lib/supabase/server";

export async function DELETE() {
  const user = await getServerSession();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  await supabase
    .from("spotify_accounts")
    .delete()
    .eq("userId", user.id);

  return NextResponse.json({ success: true });
}
