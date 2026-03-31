import { getServerSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { GuestGuard } from "@/components/guest/GuestGuard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerSession();
  const cookieStore = await cookies();
  const isGuest = cookieStore.get("guestMode")?.value === "1";

  if (!user && !isGuest) {
    redirect("/auth/signin");
  }

  const content = (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">{children}</div>
  );

  // Guest mode: wrap with guard that validates localStorage sync + expiry
  if (isGuest && !user) {
    return <GuestGuard>{content}</GuestGuard>;
  }

  // Authenticated user — no SessionProvider needed with Supabase
  return content;
}
