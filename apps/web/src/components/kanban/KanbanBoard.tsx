"use client";

import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";
import { DeleteZone } from "./DeleteZone";
import { KanbanTask, KANBAN_COLUMNS, COLUMN_ORDER } from "@/types/kanban";
import { TaskStatus, TaskPriority } from "@/types/database";
import { FocusStartDialog } from "@/components/focus/FocusStartDialog";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/** Priority weight — higher = more important (sort DESC) */
const PRIORITY_WEIGHT: Record<string, number> = {
  [TaskPriority.URGENT]: 4,
  [TaskPriority.HIGH]: 3,
  [TaskPriority.MEDIUM]: 2,
  [TaskPriority.LOW]: 1,
};

/** Column-specific sort comparators */
function sortBacklog(a: KanbanTask, b: KanbanTask): number {
  // 1. order ASC (drag-drop)
  if (a.order !== b.order) return a.order - b.order;
  // 2. priority DESC
  const pa = PRIORITY_WEIGHT[a.priority] ?? 0;
  const pb = PRIORITY_WEIGHT[b.priority] ?? 0;
  if (pa !== pb) return pb - pa;
  // 3. dueDate ASC (null → bottom)
  const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
  const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
  return da - db;
}

function sortToday(a: KanbanTask, b: KanbanTask): number {
  // Respect user drag-drop order absolutely
  if (a.order !== b.order) return a.order - b.order;
  // Tie-break: recently touched first
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function sortDone(a: KanbanTask, b: KanbanTask): number {
  // Most recently completed first
  const ca = a.completedAt ? new Date(a.completedAt).getTime() : 0;
  const cb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
  return cb - ca;
}

interface KanbanBoardProps {
  tasks: KanbanTask[];
  onTaskMove: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onTaskDelete: (taskId: string) => Promise<void>;
  onTaskReorder?: (
    taskId: string,
    newOrder: number,
    status: TaskStatus,
  ) => void;
  onAddTask?: (status: TaskStatus) => void;
  onEditTask?: (task: KanbanTask) => void;
  onTodayScrollRef?: (el: HTMLDivElement | null) => void;
}

export function KanbanBoard({
  tasks: initialTasks,
  onTaskMove,
  onTaskDelete,
  onTaskReorder,
  onAddTask,
  onEditTask,
  onTodayScrollRef,
}: KanbanBoardProps) {
  // ✅ State nội bộ để render UI mượt mà (Optimistic UI)
  // Chúng ta sync props vào state này
  const [tasks, setTasks] = useState<KanbanTask[]>(initialTasks);

  // Sync khi props thay đổi (ví dụ server trả về data mới)
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [showDeleteZone, setShowDeleteZone] = useState(false);

  // Focus dialog state
  const [focusDialogOpen, setFocusDialogOpen] = useState(false);
  const [selectedTaskForFocus, setSelectedTaskForFocus] =
    useState<KanbanTask | null>(null);

  // Mobile tab state
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [activeTab, setActiveTab] = useState<TaskStatus>(TaskStatus.TODAY);

  const { play } = useSoundEffects();

  // ✅ Cấu hình cảm biến (Sensor)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Di chuyển 5px mới tính là drag (tránh click nhầm)
      },
    }),
  );

  // ✅ Group tasks theo status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, KanbanTask[]> = {
      BACKLOG: [],
      TODAY: [],
      DONE: [],
    };

    tasks.forEach((task) => {
      if (task.status in grouped) {
        grouped[task.status]!.push(task);
      }
    });

    // Per-column sorting
    grouped.BACKLOG?.sort(sortBacklog);
    grouped.TODAY?.sort(sortToday);
    grouped.DONE?.sort(sortDone);

    return grouped;
  }, [tasks]);

  // DONE surface: only tasks completed today
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const doneSurfaceTasks = useMemo(
    () =>
      (tasksByStatus.DONE || []).filter(
        (t) => t.completedAt && new Date(t.completedAt) >= todayStart,
      ),
    [tasksByStatus.DONE, todayStart],
  );

  // ✅ Thuật toán phát hiện va chạm tùy chỉnh (Custom Collision Detection)
  const customCollisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);

    // 1. Nếu không có va chạm nào -> return
    if (pointerCollisions.length === 0) return [];

    // 2. Kiểm tra delete-zone
    const deleteZone = pointerCollisions.find((c) => c.id === "delete-zone");
    if (deleteZone) return [deleteZone];

    // 3. Ưu tiên task trước (để sort trong cùng column)
    const taskCollisions = pointerCollisions.filter(
      (c) =>
        !Object.keys(KANBAN_COLUMNS).includes(c.id as string) &&
        c.id !== "delete-zone",
    );

    if (taskCollisions.length > 0) {
      return taskCollisions;
    }

    // 4. Nếu không có task, mới return column (để move sang column khác)
    const columnCollisions = pointerCollisions.filter((c) =>
      Object.keys(KANBAN_COLUMNS).includes(c.id as string),
    );

    if (columnCollisions.length > 0) {
      return columnCollisions;
    }

    return [];
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
      setShowDeleteZone(true);
      play("task-click-drag");
    }
  };

  // ✅ Xử lý khi đang kéo - chỉ để visual feedback
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) return;

    // Hiển thị delete zone khi hover
    if (over.id === "delete-zone") {
      setShowDeleteZone(true);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveTask(null);
    setShowDeleteZone(false);

    if (!over) return;

    play("task-drop");

    const taskId = active.id as string;
    // ✅ Dùng initialTasks để lấy status gốc (chưa bị handleDragOver thay đổi)
    const originalTask = initialTasks.find((t) => t.id === taskId);
    if (!originalTask) return;

    console.log("🔍 Drag End:", {
      taskId,
      originalStatus: originalTask.status,
      overId: over.id,
    });

    // 1. Handle delete
    if (over.id === "delete-zone") {
      console.log("🗑️ Deleting task:", taskId);
      await onTaskDelete(taskId);
      return;
    }

    const overId = over.id as string;
    const isOverColumn = Object.keys(KANBAN_COLUMNS).includes(overId);

    // 2. Moving to different column
    if (isOverColumn) {
      const newStatus = overId as TaskStatus;
      console.log("📦 Column drop:", {
        originalStatus: originalTask.status,
        newStatus,
      });

      if (originalTask.status !== newStatus) {
        console.log("✅ Moving task to new column:", newStatus);
        await onTaskMove(taskId, newStatus);
      } else {
        console.log("⏭️ Same column, no move needed");
      }
      return;
    }

    // 3. Reordering within same column (dropping on another task)
    const overTask = initialTasks.find((t) => t.id === overId);
    if (!overTask) {
      console.log("⚠️ Over task not found:", overId);
      return;
    }

    console.log("🎯 Task drop:", {
      originalStatus: originalTask.status,
      overTaskStatus: overTask.status,
    });

    // If dropping on task in different column, move to that column
    if (originalTask.status !== overTask.status) {
      console.log(
        "✅ Moving task to different column via task:",
        overTask.status,
      );
      await onTaskMove(taskId, overTask.status);
      return;
    }

    // DONE column: fixed order (by completedAt DESC), no user reordering
    if (originalTask.status === TaskStatus.DONE) return;

    // If same column and different position, reorder
    if (active.id !== over.id) {
      console.log("🔄 Reordering within same column");
      const columnTasks = tasksByStatus[originalTask.status] || [];
      const oldIndex = columnTasks.findIndex((t) => t.id === active.id);
      const newIndex = columnTasks.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        // Optimistic update using arrayMove
        const reorderedColumnTasks = arrayMove(columnTasks, oldIndex, newIndex);

        // Update local state
        setTasks((prev) => {
          const otherTasks = prev.filter(
            (t) => t.status !== originalTask.status,
          );
          const updatedColumn = reorderedColumnTasks.map((task, index) => ({
            ...task,
            order: index,
          }));
          return [...otherTasks, ...updatedColumn].sort((a, b) => {
            const statusOrder = { BACKLOG: 0, TODAY: 1, DONE: 2 };
            const aOrder =
              statusOrder[a.status as keyof typeof statusOrder] || 0;
            const bOrder =
              statusOrder[b.status as keyof typeof statusOrder] || 0;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return (a.order || 0) - (b.order || 0);
          });
        });

        // Call API in background
        if (onTaskReorder) {
          console.log("📡 Calling onTaskReorder API");
          onTaskReorder(taskId, newIndex, originalTask.status);
        }
      }
    }
  };

  const handleDragCancel = () => {
    setTasks(initialTasks); // Revert về trạng thái gốc nếu hủy
    setActiveTask(null);
    setShowDeleteZone(false);
  };

  const handleStartFocus = (task: KanbanTask) => {
    setSelectedTaskForFocus(task);
    setFocusDialogOpen(true);
  };

  const handleMoveTask = async (taskId: string, newStatus: TaskStatus) => {
    await onTaskMove(taskId, newStatus);
  };

  const handleMoveToTop = (taskId: string, status: TaskStatus) => {
    if (onTaskReorder) {
      // Move to order 0 (top)
      const columnTasks = tasksByStatus[status] || [];
      const oldIndex = columnTasks.findIndex((t) => t.id === taskId);
      if (oldIndex > 0) {
        const reordered = arrayMove(columnTasks, oldIndex, 0);
        setTasks((prev) => {
          const otherTasks = prev.filter((t) => t.status !== status);
          const updatedColumn = reordered.map((task, index) => ({
            ...task,
            order: index,
          }));
          return [...otherTasks, ...updatedColumn];
        });
        onTaskReorder(taskId, 0, status);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      // ✅ Dùng thuật toán va chạm tùy chỉnh
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver} // ✅ Thêm hàm này
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {isDesktop ? (
        /* ── Desktop: 3 columns side by side ─────────────────────── */
        <div className="flex gap-4 overflow-x-auto p-4 h-full items-start">
          {COLUMN_ORDER.map((status) => {
            const columnTasks = tasksByStatus[status] || [];
            // DONE surface: only show today's completed tasks
            const surfaceTasks = status === TaskStatus.DONE ? doneSurfaceTasks : columnTasks;
            const allColumnTasks = columnTasks;
            return (
              <SortableContext
                key={status}
                items={columnTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <KanbanColumn
                  status={status}
                  title={KANBAN_COLUMNS[status].title}
                  tasks={surfaceTasks}
                  allTasks={allColumnTasks}
                  color={KANBAN_COLUMNS[status].color}
                  onAddTask={onAddTask}
                  onEditTask={onEditTask}
                  onStartFocus={handleStartFocus}
                  onTaskMove={handleMoveTask}
                  onTaskMoveToTop={handleMoveToTop}
                  onTodayScrollRef={status === TaskStatus.TODAY ? onTodayScrollRef : undefined}
                />
              </SortableContext>
            );
          })}
        </div>
      ) : (
        /* ── Mobile: Tab bar + single active column ───────────────── */
        <div className="flex flex-col h-full">
          {/* Tab bar */}
          <div className="flex border-b border-white/10 bg-background/50 backdrop-blur-sm shrink-0  mt-2 rounded-sm overflow-hidden">
            {COLUMN_ORDER.map((status) => {
              const count = (tasksByStatus[status] || []).length;
              const isActive = activeTab === status;
              return (
                <button
                  key={status}
                  onClick={() => setActiveTab(status)}
                  className={`flex-1 flex flex-col items-center justify-center py-2.5 text-xs font-medium transition-colors relative ${
                    isActive
                      ? "text-white bg-white/10"
                      : "text-muted-foreground hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="text-base leading-none mb-0.5">
                    {KANBAN_COLUMNS[status].title.split(" ")[0]}
                  </span>
                  <span className={`text-[10px] ${isActive ? "text-white/80" : "text-muted-foreground/60"}`}>
                    {KANBAN_COLUMNS[status].title.split(" ").slice(1).join(" ")}
                    {count > 0 && (
                      <span className={`ml-1 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[9px] font-semibold ${
                        isActive ? "bg-primary/80 text-white" : "bg-white/10"
                      }`}>
                        {count}
                      </span>
                    )}
                  </span>
                  {/* Active underline */}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active column */}
          <div className="flex-1 overflow-y-auto p-4 px-0">
            {COLUMN_ORDER.filter((s) => s === activeTab).map((status) => {
              const columnTasks = tasksByStatus[status] || [];
              const surfaceTasks = status === TaskStatus.DONE ? doneSurfaceTasks : columnTasks;
              const allColumnTasks = columnTasks;
              return (
                <SortableContext
                  key={status}
                  items={columnTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <KanbanColumn
                    status={status}
                    title={KANBAN_COLUMNS[status].title}
                    tasks={surfaceTasks}
                    allTasks={allColumnTasks}
                    color={KANBAN_COLUMNS[status].color}
                    className="w-full max-w-none min-w-0"
                    onAddTask={onAddTask}
                    onEditTask={onEditTask}
                    onStartFocus={handleStartFocus}
                    onTaskMove={handleMoveTask}
                    onTaskMoveToTop={handleMoveToTop}
                    onTodayScrollRef={status === TaskStatus.TODAY ? onTodayScrollRef : undefined}
                  />
                </SortableContext>
              );
            })}
          </div>
        </div>
      )}

      {showDeleteZone && <DeleteZone />}

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div
            className="
              transform scale-105 rotate-2
              shadow-2xl shadow-primary/30
              opacity-90 cursor-grabbing
            "
          >
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>

      {/* Focus Start Dialog */}
      {selectedTaskForFocus && (
        <FocusStartDialog
          task={selectedTaskForFocus}
          open={focusDialogOpen}
          onClose={() => {
            setFocusDialogOpen(false);
            setSelectedTaskForFocus(null);
          }}
        />
      )}
    </DndContext>
  );
}
