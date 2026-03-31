"use client";

import { useState } from "react";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalBody,
} from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import { useGuestStore } from "@/stores/useGuestStore";
import { clearGuestCookie } from "@/hooks/useIsGuest";
import type { KanbanTask } from "@/types/kanban";

interface MigrateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: KanbanTask[];
  onComplete: () => void;
}

export function MigrateModal({
  open,
  onOpenChange,
  tasks,
  onComplete,
}: MigrateModalProps) {
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearGuest = useGuestStore((s) => s.clearGuest);
  const t = useTranslations("guest");

  const handleMigrate = async () => {
    setMigrating(true);
    setError(null);
    try {
      const payload = tasks.map((t) => ({
        title: t.title,
        description: t.description ?? undefined,
        status: t.status,
        priority: t.priority,
        estimatedPomodoros: t.estimatedPomodoros ?? undefined,
        tags: t.tags ?? undefined,
        dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : undefined,
      }));
      await api.post("/tasks/batch", { tasks: payload });
      clearGuest();
      clearGuestCookie();
      onComplete();
    } catch {
      setError(t("migrateError"));
    } finally {
      setMigrating(false);
    }
  };

  const handleSkip = () => {
    clearGuest();
    clearGuestCookie();
    onComplete();
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent dialogClassName="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{t("migrateTitle")}</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            {t("migrateDescription", { count: tasks.length })}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <ResponsiveModalBody className="space-y-4">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md p-2">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button onClick={handleMigrate} disabled={migrating}>
              {migrating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("migrating", { count: tasks.length })}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {t("mergeData")}
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={handleSkip}
              disabled={migrating}
              className="text-muted-foreground"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("skipAndDelete")}
            </Button>
          </div>
        </ResponsiveModalBody>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
