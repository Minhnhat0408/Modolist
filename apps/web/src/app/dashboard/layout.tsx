import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SessionProvider } from "next-auth/react";
import { GuestGuard } from "@/components/guest/GuestGuard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const cookieStore = await cookies();
  const isGuest = cookieStore.get("guestMode")?.value === "1";

  if (!session?.user && !isGuest) {
    redirect("/auth/signin");
  }

  const content = (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">{children}</div>
  );

  // Guest mode: wrap with guard that validates localStorage sync + expiry
  if (isGuest && !session?.user) {
    return <GuestGuard>{content}</GuestGuard>;
  }

  // Authenticated user
  return <SessionProvider session={session}>{content}</SessionProvider>;
}
