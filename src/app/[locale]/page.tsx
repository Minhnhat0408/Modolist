import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { CheckCircle, Target, Users, Zap } from "lucide-react";

export default function Home() {
  const t = useTranslations("landing");
  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Target className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">{t("brand")}</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <ThemeToggle />
            <Link href="/auth/signin">
              <Button variant="ghost">{t("signIn")}</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>{t("signUp")}</Button>
            </Link>
          </div>
        </nav>
      </header>

      <main className="container mx-auto px-4">
        <section className="py-20 text-center">
          <div className="mx-auto max-w-3xl space-y-6">
            <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
              {t("heroTitle")}{" "}
              <span className="text-primary">{t("heroTitleHighlight")}</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              {t("heroDescription")}
            </p>
            <div className="flex items-center justify-center gap-4 pt-4">
              <Link href="/auth/signup">
                <Button size="lg" className="text-lg">
                  {t("getStarted")}
                </Button>
              </Link>
              <Link href="/auth/signin">
                <Button size="lg" variant="outline" className="text-lg">
                  {t("learnMore")}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>{t("featureQuickTitle")}</CardTitle>
                <CardDescription>
                  {t("featureQuickDesc")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>{t("featureTeamTitle")}</CardTitle>
                <CardDescription>
                  {t("featureTeamDesc")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>{t("featureTrackTitle")}</CardTitle>
                <CardDescription>
                  {t("featureTrackDesc")}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="py-16">
          <Card className="border-2">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl">{t("highlightTitle")}</CardTitle>
              <CardDescription className="text-lg">
                {t("highlightSubtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex gap-3">
                  <CheckCircle className="h-6 w-6 shrink-0 text-primary" />
                  <div>
                    <h3 className="font-semibold">{t("highlightKanban")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t("highlightKanbanDesc")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-6 w-6 shrink-0 text-primary" />
                  <div>
                    <h3 className="font-semibold">{t("highlightRealtime")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t("highlightRealtimeDesc")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-6 w-6 shrink-0 text-primary" />
                  <div>
                    <h3 className="font-semibold">{t("highlightTheme")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t("highlightThemeDesc")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-6 w-6 shrink-0 text-primary" />
                  <div>
                    <h3 className="font-semibold">{t("highlightSecurity")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t("highlightSecurityDesc")}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="py-20 text-center">
          <div className="mx-auto max-w-2xl space-y-6">
            <h2 className="text-4xl font-bold text-foreground">
              {t("ctaTitle")}
            </h2>
            <p className="text-xl text-muted-foreground">
              {t("ctaDescription")}
            </p>
            <div className="flex items-center justify-center gap-4 pt-4">
              <Link href="/auth/signup">
                <Button size="lg" className="text-lg">
                  {t("signUpFree")}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center space-x-2">
              <Target className="h-6 w-6 text-primary" />
              <span className="font-semibold text-foreground">{t("brand")}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("copyright")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
