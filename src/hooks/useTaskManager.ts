"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useIsGuest } from "@/hooks/useIsGuest";
import { useGuestStore } from "@/stores/useGuestStore";
import { api } from "@/lib/api-client";
import type { KanbanTask } from "@/types/kanban";
import type { Task } from "@/types/database";
import { TaskStatus } from "@/types/database";

type TaskPatchResponse = Task & { spawnedTask?: Task | null };

function addSpawnedTask(prev: KanbanTask[], spawned: Task | null | undefined) {
  if (!spawned) return prev;
  if (prev.some((t) => t.id === spawned.id)) return prev;
  return [spawned as KanbanTask, ...prev];
}

function mergePatchedTask(prev: KanbanTask[], patched: Task | null | undefined) {
  if (!patched) return prev;
  if (patched.isArchived) {
    return prev.filter((task) => task.id !== patched.id);
  }
  if (prev.some((task) => task.id === patched.id)) {
    return prev.map((task) => {
      if (task.id !== patched.id) return task;
      // Preserve existing focusSessions if the patched response omits them
      const sessions =
        (patched as KanbanTask).focusSessions ?? task.focusSessions;
      return { ...task, ...(patched as KanbanTask), focusSessions: sessions };
    });
  }
  return [patched as KanbanTask, ...prev];
}

export function useTaskManager() {
  const isGuest = useIsGuest();
  const guestStore = useGuestStore();
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [doneHistoryCount, setDoneHistoryCount] = useState(0);
  const [backlogCount, setBacklogCount] = useState(0);
  const initializedRef = useRef(false);

  // Sync guest tasks into local state
  useEffect(() => {
    if (isGuest) {
      setTasks(guestStore.tasks);
      setDoneHistoryCount(
        guestStore.tasks.filter((task) => task.status === TaskStatus.DONE).length,
      );
      setBacklogCount(
        guestStore.tasks.filter((task) => task.status === TaskStatus.BACKLOG).length,
      );
      setLoading(false);
    }
  }, [isGuest, guestStore.tasks]);

  const fetchDoneHistoryCount = useCallback(async (): Promise<number> => {
    if (isGuest) {
      const count = guestStore.tasks.filter(
        (task) => task.status === TaskStatus.DONE,
      ).length;
      setDoneHistoryCount(count);
      return count;
    }
    try {
      const response = await api.get<{ count: number } | number>(
        "/tasks/done-history/count",
      );
      const count =
        typeof response === "number"
          ? response
          : (response?.count ?? 0);
      setDoneHistoryCount(count);
      return count;
    } catch (error) {
      console.error("Error fetching done history count:", error);
      return 0;
    }
  }, [isGuest, guestStore.tasks]);

  const fetchBacklogCount = useCallback(async (): Promise<number> => {
    if (isGuest) {
      const count = guestStore.tasks.filter(
        (task) => task.status === TaskStatus.BACKLOG,
      ).length;
      setBacklogCount(count);
      return count;
    }
    try {
      const response = await api.get<{ count: number } | number>(
        "/tasks/backlog/count",
      );
      const count =
        typeof response === "number"
          ? response
          : (response?.count ?? 0);
      setBacklogCount(count);
      return count;
    } catch (error) {
      console.error("Error fetching backlog count:", error);
      return 0;
    }
  }, [isGuest, guestStore.tasks]);

  const fetchBacklog = useCallback(async (): Promise<KanbanTask[]> => {
    if (isGuest) {
      return guestStore.tasks.filter((task) => task.status === TaskStatus.BACKLOG);
    }
    try {
      return await api.get<KanbanTask[]>("/tasks/backlog");
    } catch (error) {
      console.error("Error fetching backlog:", error);
      return [];
    }
  }, [isGuest, guestStore.tasks]);

  const fetchTasks = useCallback(async () => {
    if (isGuest) {
      setTasks(guestStore.tasks);
      setDoneHistoryCount(
        guestStore.tasks.filter((task) => task.status === TaskStatus.DONE).length,
      );
      setBacklogCount(
        guestStore.tasks.filter((task) => task.status === TaskStatus.BACKLOG).length,
      );
      return;
    }
    try {
      const [data, doneCountResponse, backlogCountResponse] = await Promise.all([
        api.get<KanbanTask[]>("/tasks"),
        api.get<{ count: number } | number>("/tasks/done-history/count"),
        api.get<{ count: number } | number>("/tasks/backlog/count"),
      ]);
      const doneCount =
        typeof doneCountResponse === "number"
          ? doneCountResponse
          : (doneCountResponse?.count ?? 0);
      const bkCount =
        typeof backlogCountResponse === "number"
          ? backlogCountResponse
          : (backlogCountResponse?.count ?? 0);
      setTasks(data);
      setDoneHistoryCount(doneCount);
      setBacklogCount(bkCount);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  }, [isGuest, guestStore.tasks]);

  // Initial load (API users only — guest syncs via useEffect above)
  useEffect(() => {
    if (initializedRef.current) return;
    if (isGuest) {
      initializedRef.current = true;
      return;
    }
    initializedRef.current = true;
    setLoading(true);
    fetchTasks().finally(() => setLoading(false));
  }, [isGuest, fetchTasks]);

  const addTask = useCallback(
    async (data: Partial<Task>): Promise<KanbanTask | null> => {
      if (isGuest) {
        const task = guestStore.addTask(data as Partial<KanbanTask>);
        if (task?.status === TaskStatus.DONE) {
          setDoneHistoryCount((prev) => prev + 1);
        }
        return task;
      }

      // Optimistic update — show task immediately while API call is in-flight
      const tempId = `temp_${Date.now()}`;
      const optimisticTask: KanbanTask = {
        id: tempId,
        title: data.title ?? "",
        description: data.description ?? null,
        status: (data.status as TaskStatus) ?? TaskStatus.TODAY,
        priority: data.priority ?? "MEDIUM",
        order: -1,
        tags: data.tags ?? [],
        dueDate: data.dueDate ?? null,
        completedAt: null,
        completedPomodoros: 0,
        estimatedPomodoros: data.estimatedPomodoros ?? null,
        isArchived: false,
        recurrence: data.recurrence ?? "NONE",
        recurrenceDaysOfWeek: data.recurrenceDaysOfWeek ?? [],
        recurrenceDayOfMonth: data.recurrenceDayOfMonth ?? null,
        userId: "",
        createdAt: new Date(),
        updatedAt: new Date(),
        suggestedSessionType: data.suggestedSessionType ?? null,
        suggestedSessions: data.suggestedSessions ?? null,
        suggestedTotalMinutes: data.suggestedTotalMinutes ?? null,
        focusTotalSessions: null,
        stableKey: tempId,
      } as KanbanTask;

      setTasks((prev) => [optimisticTask, ...prev]);

      try {
        const newTask = await api.post<Task>("/tasks", data);
        // Replace temp task with real one, preserving stableKey so React doesn't re-animate
        setTasks((prev) =>
          prev.map((t) => (t.id === tempId ? { ...(newTask as KanbanTask), stableKey: tempId } : t)),
        );
        if (newTask.status === TaskStatus.DONE) {
          setDoneHistoryCount((prev) => prev + 1);
        }
        return newTask as KanbanTask;
      } catch (error) {
        // Rollback optimistic update on failure
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
        console.error("Error creating task:", error);
        return null;
      }
    },
    [isGuest, guestStore],
  );

  const updateTask = useCallback(
    async (id: string, data: Partial<Task>) => {
      if (isGuest) {
        guestStore.updateTask(id, data as Partial<KanbanTask>);
        setDoneHistoryCount(
          guestStore.tasks.filter((task) => task.status === TaskStatus.DONE).length,
        );
        return;
      }
      const previousTasks = [...tasks];
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? ({ ...t, ...data } as KanbanTask) : t,
        ),
      );
      try {
        const response = await api.patch<TaskPatchResponse>(`/tasks/${id}`, data);
        setTasks((prev) =>
          addSpawnedTask(mergePatchedTask(prev, response), response?.spawnedTask),
        );
        await Promise.all([fetchDoneHistoryCount(), fetchBacklogCount()]);
      } catch (error) {
        console.error("Error updating task:", error);
        setTasks(previousTasks);
      }
    },
    [isGuest, guestStore, tasks, fetchDoneHistoryCount, fetchBacklogCount],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (isGuest) {
        const target = guestStore.tasks.find((task) => task.id === id);
        guestStore.deleteTask(id);
        if (target?.status === TaskStatus.DONE) {
          setDoneHistoryCount((prev) => Math.max(0, prev - 1));
        } else if (target?.status === TaskStatus.BACKLOG) {
          setBacklogCount((prev) => Math.max(0, prev - 1));
        }
        return;
      }
      const previousTasks = [...tasks];
      const target = tasks.find((task) => task.id === id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      try {
        await api.delete(`/tasks/${id}`);
        if (target?.status === TaskStatus.DONE) {
          setDoneHistoryCount((prev) => Math.max(0, prev - 1));
        } else if (target?.status === TaskStatus.BACKLOG) {
          setBacklogCount((prev) => Math.max(0, prev - 1));
        }
      } catch (error) {
        console.error("Error deleting task:", error);
        setTasks(previousTasks);
      }
    },
    [isGuest, guestStore, tasks],
  );

  const moveTask = useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      if (isGuest) {
        guestStore.updateTask(taskId, { status: newStatus });
        setDoneHistoryCount(
          guestStore.tasks.filter((task) => task.status === TaskStatus.DONE).length,
        );
        return;
      }
      const previousTasks = [...tasks];
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            status: newStatus,
            completedAt:
              newStatus === TaskStatus.DONE
                ? (t.completedAt ?? new Date())
                : t.status === TaskStatus.DONE
                  ? null
                  : t.completedAt,
          };
        }),
      );
      try {
        const response = await api.patch<TaskPatchResponse>(`/tasks/${taskId}`, {
          status: newStatus,
        });
        setTasks((prev) =>
          addSpawnedTask(mergePatchedTask(prev, response), response?.spawnedTask),
        );
        await Promise.all([fetchDoneHistoryCount(), fetchBacklogCount()]);
      } catch (error) {
        console.error("Error updating task:", error);
        setTasks(previousTasks);
      }
    },
    [isGuest, guestStore, tasks, fetchDoneHistoryCount, fetchBacklogCount],
  );

  const reorderTask = useCallback(
    async (taskId: string, newOrder: number, status: TaskStatus) => {
      if (isGuest) {
        guestStore.reorderTask(taskId, newOrder, status);
        return;
      }
      try {
        await api.patch(`/tasks/${taskId}/order`, { newOrder, status });
      } catch (error) {
        console.error("Failed to update task order:", error);
        await fetchTasks();
      }
    },
    [isGuest, guestStore, fetchTasks],
  );

  const duplicateToToday = useCallback(
    async (taskId: string): Promise<KanbanTask | null> => {
      if (isGuest) {
        const original = guestStore.tasks.find((t) => t.id === taskId);
        if (!original) return null;
        const dup = guestStore.addTask({
          title: original.title,
          description: original.description,
          priority: original.priority,
          tags: original.tags,
          estimatedPomodoros: original.estimatedPomodoros,
          recurrence: original.recurrence,
          recurrenceDaysOfWeek: original.recurrenceDaysOfWeek,
          recurrenceDayOfMonth: original.recurrenceDayOfMonth,
          status: TaskStatus.TODAY,
        });
        return dup;
      }
      try {
        const newTask = await api.post<KanbanTask>(`/tasks/${taskId}/duplicate`);
        if (newTask) {
          setTasks((prev) => [newTask, ...prev]);
        }
        return newTask ?? null;
      } catch (error) {
        console.error("Error duplicating task:", error);
        return null;
      }
    },
    [isGuest, guestStore, setTasks],
  );

  const fetchDoneHistory = useCallback(async (): Promise<KanbanTask[]> => {
    if (isGuest) {
      return guestStore.tasks.filter((task) => task.status === TaskStatus.DONE);
    }
    try {
      return await api.get<KanbanTask[]>("/tasks/done-history");
    } catch (error) {
      console.error("Error fetching done history:", error);
      return [];
    }
  }, [isGuest, guestStore.tasks]);

  return {
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
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    reorderTask,
    duplicateToToday,
  };
}
