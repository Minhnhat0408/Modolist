"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserNav } from "@/components/user-nav";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TaskFormDialog } from "@/components/kanban/TaskFormDialog";
import { FocusTimer } from "@/components/focus/FocusTimer";
import { useFocusStore } from "@/stores/useFocusStore";
import { KanbanTask } from "@/types/kanban";
import type { Task } from "@/types/database";
import { TaskStatus } from "@/types/database";
import { api } from "@/lib/api-client";
import Image from "next/image";
import { StatsModal } from "@/components/stats/StatsModal";
import { AITaskGenerator } from "@/components/ai/AITaskGenerator";
import { TaskDetailModal } from "@/components/kanban/TaskDetailModal";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api.get<KanbanTask[]>("/tasks");
      setTasks(data);
      console.log(data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  }, []);

  // Restore any interrupted/paused focus session on mount
  const restoreSession = useFocusStore((s) => s.restoreSession);
  useEffect(() => {
    if (status === "authenticated") {
      restoreSession();
    }
  }, [status, restoreSession]);

  useEffect(() => {
    async function loadTasks() {
      if (status !== "authenticated") return;

      setLoading(true);
      await fetchTasks();
      setLoading(false);
    }

    loadTasks();

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
  }, [status, fetchTasks]);

  const handleTaskMove = async (taskId: string, newStatus: TaskStatus) => {
    console.log("🚀 handleTaskMove called:", { taskId, newStatus });
    const previousTasks = [...tasks];

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task,
      ),
    );

    try {
      console.log("📡 Calling API PATCH /tasks/" + taskId, {
        status: newStatus,
      });
      await api.patch(`/tasks/${taskId}`, { status: newStatus });
      console.log("✅ Task moved successfully");
    } catch (error) {
      console.error("❌ Error updating task:", error);
      setTasks(previousTasks);
    }
  };

  const handleTaskReorder = async (
    taskId: string,
    newOrder: number,
    status: TaskStatus,
  ) => {
    // API call to persist order (already updated optimistically in KanbanBoard)
    try {
      await api.patch(`/tasks/${taskId}/order`, {
        newOrder,
        status,
      });
    } catch (error) {
      console.error("Failed to update task order:", error);
      // Optionally refetch to revert
      await fetchTasks();
    }
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
    [],
  );

  const handleDetailTaskDelete = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const handleTaskSubmit = async (data: Partial<Task>) => {
    if (editingTask) {
      const previousTasks = [...tasks];
      setTasks((prev) =>
        prev.map((task) =>
          task.id === editingTask.id ? { ...task, ...data } : task,
        ),
      );
      api.patch(`/tasks/${editingTask.id}`, data).catch((error) => {
        console.error("Error updating task:", error);
        setTasks(previousTasks);
      });
    } else {
      try {
        const newTask = await api.post<Task>("/tasks", data);
        // Prepend so new task appears first in its column
        setTasks((prev) => [newTask as KanbanTask, ...prev]);
        // Scroll TODAY column to top so user sees the new task
        if ((newTask as KanbanTask).status === TaskStatus.TODAY) {
          requestAnimationFrame(() => {
            if (todayScrollRef.current) todayScrollRef.current.scrollTop = 0;
          });
        }
      } catch (error) {
        console.error("Error creating task:", error);
      }
    }
  };

  const handleDeleteTask = async () => {
    if (!editingTask) return;

    try {
      await api.delete(`/tasks/${editingTask.id}`);
      setDialogOpen(false);
      await fetchTasks();
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const handleDeleteTaskById = async (taskId: string) => {
    const previousTasks = [...tasks];
    setTasks((prev) => prev.filter((task) => task.id !== taskId));

    try {
      await api.delete(`/tasks/${taskId}`);
    } catch (error) {
      setTasks(previousTasks);
      console.error("Error deleting task:", error);
    }
  };

  if (status === "loading" || loading) {
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
          <p className="mt-4 text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

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
        <div className="flex items-center  justify-between mb-5">
          <div>
            <h1 className="text-3xl font-bold">Danh sách công việc</h1>
            <p className="text-muted-foreground">
              Xin chào, <strong>{session?.user?.name}</strong>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <UserNav
              user={session?.user}
              onStatsClick={() => setStatsOpen(true)}
              onAIClick={() => setAIOpen(true)}
            />
          </div>
        </div>

        <KanbanBoard
          tasks={tasks}
          onTaskMove={handleTaskMove}
          onTaskDelete={handleDeleteTaskById}
          onTaskReorder={handleTaskReorder}
          onAddTask={handleAddTask}
          onEditTask={handleEditTask}
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

        {/* Stats Modal */}
        <StatsModal open={statsOpen} onOpenChange={setStatsOpen} />

        {/* AI Task Generator */}
        <AITaskGenerator
          open={aiOpen}
          onOpenChange={setAIOpen}
          onTasksCreated={fetchTasks}
        />
      </div>
    </div>
  );
}
