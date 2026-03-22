"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { KanbanTask } from "@/types/kanban";
import { TaskStatus } from "@/types/database";
import { TaskCard } from "./TaskCard";
import { ColumnOverflowDrawer } from "./ColumnOverflowDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Play, ChevronDown, CalendarDays } from "lucide-react";
import clsx from "clsx";

/** Max tasks shown directly in the column before truncating */
const VISIBLE_LIMIT = 3;

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  /** Tasks shown directly on the column surface */
  tasks: KanbanTask[];
  /** All tasks in the column (for drawer). Falls back to tasks if omitted. */
  allTasks?: KanbanTask[];
  totalCountOverride?: number;
  onLoadAllTasks?: () => Promise<KanbanTask[]>;
  onRefreshTotalCount?: () => Promise<number>;
  color: string;
  className?: string;
  onAddTask?: (status: TaskStatus) => void;
  onEditTask?: (task: KanbanTask) => void;
  onStartFocus?: (task: KanbanTask) => void;
  onTaskMove?: (taskId: string, newStatus: TaskStatus) => void;
  onTaskMoveToTop?: (taskId: string, status: TaskStatus) => void;
  onDuplicate?: (task: KanbanTask) => void;
  onTodayScrollRef?: (el: HTMLDivElement | null) => void;
}

export function KanbanColumn({
  status,
  title,
  tasks,
  allTasks,
  totalCountOverride,
  onLoadAllTasks,
  onRefreshTotalCount,
  color,
  className,
  onAddTask,
  onEditTask,
  onStartFocus,
  onTaskMove,
  onTaskMoveToTop,
  onDuplicate,
  onTodayScrollRef,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const isToday = status === TaskStatus.TODAY;

  const isDone = status === TaskStatus.DONE;
  const drawerTasks = allTasks ?? tasks;
  const totalCount = totalCountOverride ?? drawerTasks.length;

  // ── Truncation logic (not used for TODAY — it scrolls inline) ────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState(title);
  const [drawerTaskSet, setDrawerTaskSet] = useState<KanbanTask[]>(drawerTasks);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const hasOverflow = !isToday && tasks.length > VISIBLE_LIMIT;
  const visibleTasks = hasOverflow ? tasks.slice(0, VISIBLE_LIMIT) : tasks;
  const overflowCount = tasks.length - VISIBLE_LIMIT;
  const doneHasHistory = isDone && totalCount > 0;

  const openSurfaceDrawer = () => {
    setDrawerTitle(title);
    setDrawerTaskSet(drawerTasks);
    setDrawerLoading(false);
    setDrawerOpen(true);
  };

  const openLazyDrawer = async (customTitle?: string) => {
    const label = customTitle ?? title;
    setDrawerTitle(label);
    setDrawerTaskSet([]);
    setDrawerLoading(true);
    setDrawerOpen(true);

    if (!onLoadAllTasks) {
      setDrawerTaskSet(drawerTasks);
      setDrawerLoading(false);
      return;
    }

    try {
      const loadedTasks = await onLoadAllTasks();
      setDrawerTaskSet(loadedTasks);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleOverflowClick = () => {
    if (onLoadAllTasks) {
      void openLazyDrawer(isDone ? "Nhiệm vụ đã hoàn thành hôm nay" : title);
    } else {
      openSurfaceDrawer();
    }
  };

  const handleDoneHistoryClick = () => {
    void openLazyDrawer("Tất cả nhiệm vụ đã hoàn thành");
  };

  const handleDrawerTaskMove = async (taskId: string, newStatus: TaskStatus) => {
    await onTaskMove?.(taskId, newStatus);
    setDrawerTaskSet((prev) => prev.filter((task) => task.id !== taskId));
    await onRefreshTotalCount?.();
  };

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        flex-1 min-w-80 max-w-md
        ${isOver ? "ring-2 ring-primary/50 scale-[1.02]" : ""}
        transition-all duration-200
        ${className ?? ""}
      `}
    >
      <div
        className={clsx(
          `
          h-full rounded-2xl
          backdrop-blur-xl

          shadow-xl
        `,
          color,
        )}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">{title}</h3>
              <Badge
                variant="secondary"
                className="h-6 min-w-6 px-2 rounded-full bg-white/10 backdrop-blur-sm"
              >
                {isDone ? tasks.length : totalCount}
              </Badge>
              {isDone && doneHasHistory && (
                <span className="text-xs text-muted-foreground/60">
                  /{totalCount} tổng
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-white/10 rounded-full"
              onClick={() => onAddTask?.(status)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {isToday && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                className="w-full  cursor-pointer bg-primary/20 hover:bg-primary/30 border border-primary/30 backdrop-blur-sm group relative overflow-hidden"
                onClick={() => {
                  // Auto-select first task in Today column
                  const firstTask = tasks[0];
                  if (firstTask && onStartFocus) {
                    onStartFocus(firstTask);
                  }
                }}
                disabled={tasks.length === 0}
                size="lg"
              >
                <motion.div
                  className="absolute inset-0 bg-primary"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <Play className="mr-2 h-5 w-5 z-10 font-bold text-black" />
                <span className="relative z-10">Bắt đầu Focus Mode</span>
              </Button>
            </motion.div>
          )}
        </div>

        <div
          ref={isToday ? onTodayScrollRef : undefined}
          className={clsx(
            "px-4 mb-4 pt-0 space-y-3 min-h-50",
            isToday &&
              "max-h-[58vh] pt-2 pb-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
          )}
        >
          {(isToday ? tasks : visibleTasks).map((task, index) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: index * 0.05 }}
              layout
            >
              <TaskCard
                task={task}
                onEdit={onEditTask}
                onStartFocus={onStartFocus}
                onDuplicate={onDuplicate}
                showCreatedDate={status === TaskStatus.BACKLOG}
              />
            </motion.div>
          ))}

          {/* ── "Show more" button ── */}
          {hasOverflow && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: VISIBLE_LIMIT * 0.05 }}
            >
              <button
                onClick={handleOverflowClick}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-muted-foreground/70 hover:text-muted-foreground hover:bg-white/5 rounded-xl transition-colors cursor-pointer border border-dashed border-white/10 hover:border-white/20"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                {isDone
                  ? `Xem thêm ${overflowCount} nhiệm vụ hôm nay`
                  : `Xem thêm ${overflowCount} nhiệm vụ...`}
              </button>
            </motion.div>
          )}

          {isDone && doneHasHistory && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <button
                onClick={handleDoneHistoryClick}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-muted-foreground/70 hover:text-muted-foreground hover:bg-white/5 rounded-xl transition-colors cursor-pointer border border-dashed border-white/10 hover:border-white/20"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Xem tất cả nhiệm vụ đã hoàn thành
              </button>
            </motion.div>
          )}

          {tasks.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-sm text-muted-foreground"
            >
              Chưa có nhiệm vụ
            </motion.div>
          )}
        </div>

        {/* ── Overflow Drawer/Dialog (BACKLOG + DONE only) ── */}
        {!isToday && (
          <ColumnOverflowDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            title={drawerTitle}
            status={status}
            tasks={drawerTaskSet}
            loading={drawerLoading}
            onEditTask={onEditTask}
            onStartFocus={onStartFocus}
            onTaskMove={handleDrawerTaskMove}
            onTaskMoveToTop={onTaskMoveToTop}
            onDuplicate={onDuplicate}
          />
        )}
      </div>
    </motion.div>
  );
}
