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
      setError("Không thể chuyển dữ liệu. Vui lòng thử lại.");
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
          <ResponsiveModalTitle>Chuyển dữ liệu khách</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Chúng tôi tìm thấy {tasks.length} task bạn đã tạo khi dùng thử.
            Bạn có muốn gộp vào tài khoản?
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
                  Đang chuyển {tasks.length} tasks...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Gộp data vào tài khoản
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
              Bỏ qua & xóa dữ liệu khách
            </Button>
          </div>
        </ResponsiveModalBody>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
