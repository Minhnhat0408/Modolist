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
import { TaskStatus } from "@/types/database";
import { FocusStartDialog } from "@/components/focus/FocusStartDialog";
import { useSoundEffects } from "@/hooks/useSoundEffects";

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
}

export function KanbanBoard({
  tasks: initialTasks,
  onTaskMove,
  onTaskDelete,
  onTaskReorder,
  onAddTask,
  onEditTask,
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

    // Sort nội bộ để đảm bảo thứ tự hiển thị đúng
    Object.keys(grouped).forEach((status) => {
      grouped[status]!.sort((a, b) => (a.order || 0) - (b.order || 0));
    });

    return grouped;
  }, [tasks]);

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
      <div className="flex gap-4 overflow-x-auto p-4 h-full items-start">
        {COLUMN_ORDER.map((status) => {
          const columnTasks = tasksByStatus[status] || [];
          return (
            <SortableContext
              key={status}
              items={columnTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn
                status={status}
                title={KANBAN_COLUMNS[status].title}
                tasks={columnTasks}
                color={KANBAN_COLUMNS[status].color}
                onAddTask={onAddTask}
                onEditTask={onEditTask}
                onStartFocus={handleStartFocus}
              />
            </SortableContext>
          );
        })}
      </div>

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
