"use client";

import { useFormStatus } from "react-dom";
import { Mail, Lock, ChromeIcon, UserCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authenticate, authenticateWithGoogle } from "./actions";
import { useActionState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useGuestStore } from "@/stores/useGuestStore";
import { setGuestCookie } from "@/hooks/useIsGuest";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("auth");

  return (
    <Button type="submit" disabled={pending} className="w-full" size="lg">
      {pending ? t("signingIn") : t("signIn")}
    </Button>
  );
}

export default function SignInPage() {
  const [errorMessage, dispatch] = useActionState(authenticate, undefined);
  const router = useRouter();
  const t = useTranslations("auth");
  const initGuest = useGuestStore((s) => s.initGuest);

  const handleGuestMode = () => {
    initGuest();
    setGuestCookie();
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold">{t("signInTitle")}</CardTitle>
          <CardDescription>
            {t("signInDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email/Password Form */}
          <form action={dispatch} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                {t("emailLabel")}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium flex items-center gap-2"
              >
                <Lock className="h-4 w-4" />
                {t("passwordLabel")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder={t("passwordPlaceholder")}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {errorMessage && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {errorMessage}
              </div>
            )}

            <SubmitButton />
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t("orContinueWith")}
              </span>
            </div>
          </div>

          {/* Google Sign In */}
          <form action={async () => { await authenticateWithGoogle(); }}>
            <Button type="submit" variant="outline" className="w-full">
              <ChromeIcon className="mr-2 h-4 w-4" />
              {t("signInWithGoogle")}
            </Button>
          </form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">{t("noAccount")}</span>
            <Link
              href="/auth/signup"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              {t("signUpNow")}
            </Link>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t("or")}
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={handleGuestMode}
          >
            <UserCircle className="mr-2 h-4 w-4" />
            {t("tryWithoutSignUp")}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            {t("termsAgreement")}{" "}
            <Link href="/terms" className="underline hover:text-primary">
              {t("termsOfService")}
            </Link>{" "}
            {t("and")}{" "}
            <Link href="/privacy" className="underline hover:text-primary">
              {t("privacyPolicy")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
