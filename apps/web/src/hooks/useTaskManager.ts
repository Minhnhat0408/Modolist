"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useIsGuest } from "@/hooks/useIsGuest";
import { useGuestStore } from "@/stores/useGuestStore";
import { api } from "@/lib/api-client";
import type { KanbanTask } from "@/types/kanban";
import type { Task } from "@/types/database";
import { TaskStatus } from "@/types/database";

export function useTaskManager() {
  const isGuest = useIsGuest();
  const guestStore = useGuestStore();
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  // Sync guest tasks into local state
  useEffect(() => {
    if (isGuest) {
      setTasks(guestStore.tasks);
      setLoading(false);
    }
  }, [isGuest, guestStore.tasks]);

  const fetchTasks = useCallback(async () => {
    if (isGuest) {
      setTasks(guestStore.tasks);
      return;
    }
    try {
      const data = await api.get<KanbanTask[]>("/tasks");
      setTasks(data);
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
        return task;
      }
      try {
        const newTask = await api.post<Task>("/tasks", data);
        setTasks((prev) => [newTask as KanbanTask, ...prev]);
        return newTask as KanbanTask;
      } catch (error) {
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
        return;
      }
      const previousTasks = [...tasks];
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? ({ ...t, ...data } as KanbanTask) : t,
        ),
      );
      try {
        await api.patch(`/tasks/${id}`, data);
      } catch (error) {
        console.error("Error updating task:", error);
        setTasks(previousTasks);
      }
    },
    [isGuest, guestStore, tasks],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (isGuest) {
        guestStore.deleteTask(id);
        return;
      }
      const previousTasks = [...tasks];
      setTasks((prev) => prev.filter((t) => t.id !== id));
      try {
        await api.delete(`/tasks/${id}`);
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
        return;
      }
      const previousTasks = [...tasks];
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: newStatus } : t,
        ),
      );
      try {
        await api.patch(`/tasks/${taskId}`, { status: newStatus });
      } catch (error) {
        console.error("Error updating task:", error);
        setTasks(previousTasks);
      }
    },
    [isGuest, guestStore, tasks],
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

  return {
    tasks,
    setTasks,
    loading,
    fetchTasks,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    reorderTask,
    duplicateToToday,
  };
}
