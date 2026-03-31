import { type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // 1. Run next-intl locale routing (sets locale cookie, rewrites URL)
  const intlResponse = intlMiddleware(request);

  // 2. Run Supabase session refresh + route protection on top of intl response
  return await updateSession(request, intlResponse);
}

export const config = {
  matcher: ["/((?!api|auth/callback|trpc|_next|_vercel|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|js|css)$).*)"],
};
