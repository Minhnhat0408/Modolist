import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@repo/database";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.account.deleteMany({
    where: {
      userId: session.user.id,
      provider: "spotify",
    },
  });

  return NextResponse.json({ success: true });
}
