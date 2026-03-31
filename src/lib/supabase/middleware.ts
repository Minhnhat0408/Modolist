import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

// Strip locale prefix from pathname (e.g. /vi/dashboard → /dashboard)
function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(`/${locale}`.length) || "/";
    }
  }
  return pathname;
}

export async function updateSession(request: NextRequest, response: NextResponse) {
  // Work with the response passed from next-intl middleware so cookies are preserved
  const supabaseResponse = response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // Preserve the response from next-intl but add Supabase cookies
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session (important for Server Components)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const bare = stripLocale(pathname);
  const isGuest = request.cookies.get("guestMode")?.value === "1";
  const isAuthPage = bare.startsWith("/auth");
  const isDashboard = bare.startsWith("/dashboard");

  // Detect locale prefix for redirects
  const localeMatch = routing.locales.find(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  const localePrefix = localeMatch ? `/${localeMatch}` : `/${routing.defaultLocale}`;

  // Redirect logged-in users away from auth pages
  // IMPORTANT: only redirect GET requests — POST requests are Next.js Server Actions
  // and must NOT be redirected (causes "An unexpected response was received" error)
  if (isAuthPage && user && request.method === "GET") {
    const url = request.nextUrl.clone();
    url.pathname = `${localePrefix}/dashboard`;
    return NextResponse.redirect(url);
  }

  // Protect dashboard: require auth or guest mode
  if (isDashboard && !user && !isGuest) {
    const url = request.nextUrl.clone();
    url.pathname = `${localePrefix}/auth/signin`;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
