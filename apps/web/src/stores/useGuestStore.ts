"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { TaskStatus, TaskPriority } from "@/types/database";
import type { KanbanTask } from "@/types/kanban";

const GUEST_EXPIRY_DAYS = 30;
const STORAGE_KEY = "modolist-guest";

export interface GuestFocusLog {
  date: string; // yyyy-MM-dd
  pomodoros: number;
  focusTime: number; // seconds
}

interface GuestStore {
  guestId: string | null;
  createdAt: number | null; // timestamp
  tasks: KanbanTask[];
  focusLog: GuestFocusLog[];

  // Init
  initGuest: () => void;

  // Task CRUD
  addTask: (data: Partial<KanbanTask>) => KanbanTask;
  updateTask: (id: string, data: Partial<KanbanTask>) => KanbanTask | null;
  deleteTask: (id: string) => void;
  reorderTask: (id: string, newOrder: number, status: TaskStatus) => void;

  // Focus
  logFocusSession: (entry: { pomodoros: number; focusTime: number }) => void;

  // Utils
  isExpired: () => boolean;
  clearGuest: () => void;
}

export const useGuestStore = create<GuestStore>()(
  persist(
    (set, get) => ({
      guestId: null,
      createdAt: null,
      tasks: [],
      focusLog: [],

      initGuest: () => {
        if (get().guestId) return;
        set({
          guestId: crypto.randomUUID(),
          createdAt: Date.now(),
          tasks: [],
          focusLog: [],
        });
      },

      addTask: (data) => {
        const now = new Date();
        const task: KanbanTask = {
          id: crypto.randomUUID(),
          title: data.title ?? "",
          description: data.description ?? null,
          status: data.status ?? TaskStatus.BACKLOG,
          priority: data.priority ?? TaskPriority.MEDIUM,
          completedPomodoros: 0,
          estimatedPomodoros: data.estimatedPomodoros ?? null,
          suggestedSessionType: data.suggestedSessionType ?? null,
          suggestedSessions: data.suggestedSessions ?? null,
          suggestedTotalMinutes: data.suggestedTotalMinutes ?? null,
          focusTotalSessions: data.focusTotalSessions ?? null,
          order: 0,
          tags: data.tags ?? [],
          dueDate: data.dueDate ?? null,
          completedAt: data.status === TaskStatus.DONE ? now : null,
          isArchived: false,
          userId: "guest",
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ tasks: [task, ...s.tasks] }));
        return task;
      },

      updateTask: (id, data) => {
        let updated: KanbanTask | null = null;
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            updated = { ...t, ...data, updatedAt: new Date() } as KanbanTask;
            return updated;
          }),
        }));
        return updated;
      },

      deleteTask: (id) => {
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
      },

      reorderTask: (id, newOrder, status) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, order: newOrder, status, updatedAt: new Date() } : t,
          ),
        }));
      },

      logFocusSession: (entry) => {
        const today = new Date().toISOString().split("T")[0]!;
        set((s) => {
          const existing = s.focusLog.find((l) => l.date === today);
          if (existing) {
            return {
              focusLog: s.focusLog.map((l) =>
                l.date === today
                  ? { ...l, pomodoros: l.pomodoros + entry.pomodoros, focusTime: l.focusTime + entry.focusTime }
                  : l,
              ),
            };
          }
          return { focusLog: [...s.focusLog, { date: today, ...entry }] };
        });
      },

      isExpired: () => {
        const { createdAt } = get();
        if (!createdAt) return true;
        const daysPassed = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
        return daysPassed > GUEST_EXPIRY_DAYS;
      },

      clearGuest: () => {
        set({ guestId: null, createdAt: null, tasks: [], focusLog: [] });
      },
    }),
    {
      name: STORAGE_KEY,
    },
  ),
);
