"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "@/hooks/useSupabaseSession";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { UserNav } from "@/components/user-nav";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TaskFormDialog } from "@/components/kanban/TaskFormDialog";
import { FocusTimer } from "@/components/focus/FocusTimer";
import { useFocusStore } from "@/stores/useFocusStore";
import { KanbanTask } from "@/types/kanban";
import type { Task } from "@/types/database";
import { TaskStatus } from "@/types/database";
import { useTaskManager } from "@/hooks/useTaskManager";
import { useIsGuest } from "@/hooks/useIsGuest";
import Image from "next/image";
import { StatsModal } from "@/components/stats/StatsModal";
import { AITaskGenerator } from "@/components/ai/AITaskGenerator";
import { TaskDetailModal } from "@/components/kanban/TaskDetailModal";
import { SpotifyPlayerInit } from "@/components/spotify/SpotifyPlayerInit";
import { SpotifyHeaderButton } from "@/components/spotify/SpotifyHeaderButton";
import { LanguageToggle } from "@/components/language-toggle";
import { SpotifyModal } from "@/components/spotify/SpotifyModal";
import { useSpotifyStore } from "@/stores/useSpotifyStore";
import { useGuestStore } from "@/stores/useGuestStore";
import { MigrateModal } from "@/components/guest/MigrateModal";
import { signOut } from "@/lib/auth";
import { AlertCircle, X } from "lucide-react";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tGuest = useTranslations("guest");
  const { data: session, status } = useSession();
  const isGuest = useIsGuest();
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkConnection = useSpotifyStore((s) => s.checkConnection);
  const [spotifyErrorMsg, setSpotifyErrorMsg] = useState<string | null>(null);
  const [spotifyErrorCode, setSpotifyErrorCode] = useState<string | null>(null);

  // Re-check Spotify connection after OAuth callback redirect
  useEffect(() => {
    if (searchParams.get("spotify_connected") === "true") {
      checkConnection();
      // Clean up the URL param without a full reload
      const url = new URL(window.location.href);
      url.searchParams.delete("spotify_connected");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
    const spotifyError = searchParams.get("spotify_error");
    if (spotifyError) {
      const code = decodeURIComponent(spotifyError);
      console.error("[Spotify OAuth error]", code);
      const messages: Record<string, string> = {
        state_mismatch: t("spotifyStateMismatch"),
        token_exchange_failed: t("spotifyTokenFailed"),
        profile_fetch_failed: t("spotifyProfileFailed"),
        user_not_found: t("spotifyUserNotFound"),
        access_denied: t("spotifyAccessDenied"),
      };
      setSpotifyErrorMsg(messages[code] ?? t("spotifyUnknownError", { code }));
      setSpotifyErrorCode(code);
      const url = new URL(window.location.href);
      url.searchParams.delete("spotify_error");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [searchParams, checkConnection, t]);

  const {
    tasks,
    setTasks,
    loading,
    doneHistoryCount,
    backlogCount,
    fetchTasks,
    fetchDoneHistory,
    fetchDoneHistoryCount,
    fetchBacklog,
    fetchBacklogCount,
    addTask: tmAddTask,
    updateTask: tmUpdateTask,
    deleteTask: tmDeleteTask,
    moveTask: tmMoveTask,
    reorderTask: tmReorderTask,
    duplicateToToday: tmDuplicateToToday,
  } = useTaskManager();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>(
    TaskStatus.BACKLOG,
  );
  const [statsOpen, setStatsOpen] = useState(false);
  const [aiOpen, setAIOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | undefined>(undefined);
  const todayScrollRef = useRef<HTMLDivElement | null>(null);

  // Guest migration detection
  const guestTasks = useGuestStore((s) => s.tasks);
  const guestId = useGuestStore((s) => s.guestId);
  const [migrateOpen, setMigrateOpen] = useState(false);
  const migrateCheckedRef = useRef(false);

  useEffect(() => {
    // Only show migrate modal for authenticated users who have leftover guest data
    if (
      !isGuest &&
      status === "authenticated" &&
      guestId &&
      guestTasks.length > 0 &&
      !migrateCheckedRef.current
    ) {
      migrateCheckedRef.current = true;
      setMigrateOpen(true);
    }
  }, [isGuest, status, guestId, guestTasks]);

  useEffect(() => {
    if (!isGuest && status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, isGuest, router]);

  // Restore any interrupted/paused focus session on mount
  const restoreSession = useFocusStore((s) => s.restoreSession);
  useEffect(() => {
    if (!isGuest && status === "authenticated") {
      restoreSession();
    }
  }, [status, isGuest, restoreSession]);

  useEffect(() => {
    if (isGuest) return; // Guest tasks loaded via useTaskManager

    const handleTaskCompleted = () => {
      fetchTasks();
    };

    const handleSessionCompleted = () => {
      fetchTasks();
    };

    window.addEventListener("taskCompleted", handleTaskCompleted);
    window.addEventListener("sessionCompleted", handleSessionCompleted);

    return () => {
      window.removeEventListener("taskCompleted", handleTaskCompleted);
      window.removeEventListener("sessionCompleted", handleSessionCompleted);
    };
  }, [isGuest, fetchTasks]);

  const handleTaskMove = async (taskId: string, newStatus: TaskStatus) => {
    await tmMoveTask(taskId, newStatus);
  };

  const handleTaskReorder = async (
    taskId: string,
    newOrder: number,
    status: TaskStatus,
  ) => {
    await tmReorderTask(taskId, newOrder, status);
  };

  const handleAddTask = (status: TaskStatus) => {
    setEditingTask(undefined);
    setDefaultStatus(status);
    setDialogOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setDetailTask(task);
    setDetailOpen(true);
  };

  const handleTaskFieldUpdate = useCallback(
    (taskId: string, data: Partial<Task>) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? ({ ...t, ...data } as KanbanTask) : t,
        ),
      );
      setDetailTask((prev) =>
        prev?.id === taskId ? ({ ...prev, ...data } as Task) : prev,
      );
    },
    [setTasks],
  );

  const handleDetailTaskDelete = useCallback(
    (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    },
    [setTasks],
  );

  const handleTaskSubmit = async (data: Partial<Task>) => {
    if (editingTask) {
      await tmUpdateTask(editingTask.id, data);
    } else {
      const newTask = await tmAddTask(data);
      if (newTask && newTask.status === TaskStatus.TODAY) {
        requestAnimationFrame(() => {
          if (todayScrollRef.current) todayScrollRef.current.scrollTop = 0;
        });
      }
    }
  };

  const handleDeleteTask = async () => {
    if (!editingTask) return;
    await tmDeleteTask(editingTask.id);
    setDialogOpen(false);
  };

  const handleDeleteTaskById = async (taskId: string) => {
    await tmDeleteTask(taskId);
  };

  const handleDuplicateTask = useCallback(
    async (task: KanbanTask) => {
      const newTask = await tmDuplicateToToday(task.id);
      if (newTask) {
        fetchTasks();
        requestAnimationFrame(() => {
          if (todayScrollRef.current) todayScrollRef.current.scrollTop = 0;
        });
      }
    },
    [tmDuplicateToToday, fetchTasks],
  );

  if ((!isGuest && status === "loading") || loading) {
    return (
      <div className="flex items-center bg-background justify-center min-h-screen">
        <Image
          src="/background-light.avif"
          alt="Background"
          className="fixed w-full h-full object-cover opacity-25 dark:opacity-0 pointer-events-none"
          width={1920}
          height={1080}
        />
        <Image
          src="/background.webp"
          alt="Background Dark"
          className="fixed w-full h-full object-cover opacity-0 dark:opacity-20 pointer-events-none"
          width={1920}
          height={1080}
        />
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!isGuest && status === "unauthenticated") {
    return null;
  }

  const displayName = isGuest ? tGuest("guestName") : session?.user?.name;

  return (
    <div className="min-h-screen bg-background">
      <Image
        src="/background-light.avif"
        alt="Background"
        className="fixed blur-sm w-full h-full object-cover opacity-30 dark:opacity-0 pointer-events-none"
        width={1920}
        height={1080}
      />
      <Image
        src="/background.webp"
        alt="Background Dark"
        className="fixed blur-sm w-full h-full object-cover opacity-0 dark:opacity-20 pointer-events-none"
        width={1920}
        height={1080}
      />
      <div className="container relative  mx-auto p-6">
        {/* Spotify OAuth error banner */}
        {spotifyErrorMsg && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div className="flex-1">
              <p className="font-medium text-red-200">
                {t("spotifyConnectFailed")}
              </p>
              <p className="mt-0.5 text-red-300/80">{spotifyErrorMsg}</p>
              {spotifyErrorCode === "user_not_found" && (
                <button
                  onClick={async () => { await signOut(); window.location.href = "/auth/signin"; }}
                  className="mt-2 rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-200 hover:bg-red-500/30 transition-colors"
                >
                  {t("signOutAndSignIn")}
                </button>
              )}
              {spotifyErrorCode !== "user_not_found" && (
                // eslint-disable-next-line @next/next/no-html-link-for-pages
                <a
                  href="/api/spotify/connect"
                  target="_top"
                  className="mt-2 inline-block rounded-full bg-green-500/20 px-3 py-1 text-xs font-medium text-green-300 hover:bg-green-500/30 transition-colors"
                >
                  {t("tryReconnect")}
                </a>
              )}
            </div>
            <button
              onClick={() => {
                setSpotifyErrorMsg(null);
                setSpotifyErrorCode(null);
              }}
              className="shrink-0 rounded p-0.5 hover:bg-white/10 transition-colors"
              aria-label="Đóng"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-center  justify-between mb-5">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground">
              {t("greeting")} <strong>{displayName}</strong>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <SpotifyHeaderButton />
            <UserNav
              user={session?.user ?? undefined}
              onStatsClick={() => setStatsOpen(true)}
              onAIClick={() => setAIOpen(true)}
            />
          </div>
        </div>

        <KanbanBoard
          tasks={tasks}
          doneHistoryCount={doneHistoryCount}
          loadDoneHistory={fetchDoneHistory}
          refreshDoneHistoryCount={fetchDoneHistoryCount}
          backlogCount={backlogCount}
          loadBacklog={fetchBacklog}
          refreshBacklogCount={fetchBacklogCount}
          onTaskMove={handleTaskMove}
          onTaskDelete={handleDeleteTaskById}
          onTaskReorder={handleTaskReorder}
          onAddTask={handleAddTask}
          onEditTask={handleEditTask}
          onDuplicate={handleDuplicateTask}
          onTodayScrollRef={(el) => {
            todayScrollRef.current = el;
          }}
        />

        <TaskDetailModal
          open={detailOpen}
          onOpenChange={setDetailOpen}
          task={detailTask ?? null}
          onTaskUpdated={handleTaskFieldUpdate}
          onTaskDeleted={handleDetailTaskDelete}
          onDuplicate={handleDuplicateTask}
        />

        <TaskFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleTaskSubmit}
          onDelete={editingTask ? handleDeleteTask : undefined}
          task={editingTask}
          defaultStatus={defaultStatus}
        />

        {/* Focus Timer (Modal + Floating Widget) */}
        <FocusTimer />

        {/* Spotify Player (global init — always mounted) */}
        <SpotifyPlayerInit />

        {/* Spotify Modal (opened from header button) */}
        <SpotifyModal />

        {/* Stats Modal */}
        <StatsModal open={statsOpen} onOpenChange={setStatsOpen} />

        {/* AI Task Generator */}
        <AITaskGenerator
          open={aiOpen}
          onOpenChange={setAIOpen}
          onTasksCreated={fetchTasks}
        />

        {/* Guest → Authenticated migration modal */}
        <MigrateModal
          open={migrateOpen}
          onOpenChange={setMigrateOpen}
          tasks={guestTasks}
          onComplete={() => {
            setMigrateOpen(false);
            fetchTasks();
          }}
        />
      </div>
    </div>
  );
}
