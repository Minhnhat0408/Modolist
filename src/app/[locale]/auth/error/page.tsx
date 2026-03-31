"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { AlertCircle, Home } from "lucide-react";
import { Suspense } from "react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const t = useTranslations("auth");
  const error = searchParams.get("error") || "Default";

  const errorMessages: Record<string, { title: string; description: string }> = {
    Configuration: {
      title: t("errorConfiguration"),
      description: t("errorConfigurationDesc"),
    },
    AccessDenied: {
      title: t("errorAccessDenied"),
      description: t("errorAccessDeniedDesc"),
    },
    Verification: {
      title: t("errorVerification"),
      description: t("errorVerificationDesc"),
    },
    OAuthAccountNotLinked: {
      title: t("errorOAuthNotLinked"),
      description: t("errorOAuthNotLinkedDesc"),
    },
    Default: {
      title: t("errorDefault"),
      description: t("errorDefaultDesc"),
    },
  };

  const errorInfo = errorMessages[error] || errorMessages.Default;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">
            {errorInfo?.title || t("errorOccurred")}
          </CardTitle>
          <CardDescription className="text-base">
            {errorInfo?.description ||
              t("errorDefaultDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Link href="/" className="w-full">
              <Button variant="default" className="w-full" size="lg">
                <Home className="mr-2 h-4 w-4" />
                {t("backToHome")}
              </Button>
            </Link>
            <Link href="/auth/signin" className="w-full">
              <Button variant="outline" className="w-full" size="lg">
                {t("trySignInAgain")}
              </Button>
            </Link>
          </div>

          {error !== "Default" && (
            <div className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <p className="font-semibold">{t("errorCode")}: {error}</p>
              <p className="mt-1">
                {t("errorPersist")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-muted-foreground">Đang tải...</div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
