"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { KanbanTask } from "@/types/kanban";
import { TaskPriority, TaskStatus } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Play, Clock, Zap } from "lucide-react";
import { useFocusStore } from "@/stores/useFocusStore";
import { Button } from "@/components/ui/button";

interface TaskCardProps {
  task: KanbanTask;
  onEdit?: (task: KanbanTask) => void;
  onStartFocus?: (task: KanbanTask) => void;
  showCreatedDate?: boolean;
}

export function TaskCard({
  task,
  onEdit,
  onStartFocus,
  showCreatedDate,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
  });

  const {
    activeTask,
    status: focusStatus,
    focusType,
    currentSession,
    totalSessions,
    completedSessions,
  } = useFocusStore();

  const isFocusing =
    activeTask?.id === task.id &&
    (focusStatus === "focusing" ||
      focusStatus === "break" ||
      focusStatus === "paused");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityConfig: Record<
    TaskPriority,
    { bg: string; text: string; label: string }
  > = {
    [TaskPriority.LOW]: {
      bg: "bg-blue-500/20",
      text: "text-blue-400",
      label: "Thấp",
    },
    [TaskPriority.MEDIUM]: {
      bg: "bg-yellow-500/20",
      text: "text-yellow-400",
      label: "Trung bình",
    },
    [TaskPriority.HIGH]: {
      bg: "bg-orange-500/20",
      text: "text-orange-400",
      label: "Cao",
    },
    [TaskPriority.URGENT]: {
      bg: "bg-red-500/20",
      text: "text-red-400",
      label: "Khẩn cấp",
    },
  };

  const hasSessionData = task.focusTotalSessions && task.focusTotalSessions > 0;
  const hasQuickSessions =
    !hasSessionData && task.focusCompletedSessions > 0;
  const shouldShowProgress =
    (isFocusing && focusType === "STANDARD") || hasSessionData;

  const displayTotalSessions =
    isFocusing && focusType === "STANDARD"
      ? totalSessions
      : task.focusTotalSessions || 0;
  const displayCompletedSessions =
    isFocusing && focusType === "STANDARD"
      ? completedSessions
      : task.focusCompletedSessions || 0;
  const sessionProgress =
    displayTotalSessions > 0
      ? (displayCompletedSessions / displayTotalSessions) * 100
      : 0;

  const handleStartFocus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStartFocus) {
      onStartFocus(task);
    }
  };

  const handleClick = () => {
    if (onEdit && !isDragging) {
      onEdit(task);
    }
  };

  const isToday = task.status === TaskStatus.TODAY;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`
        ${isDragging ? "opacity-40" : "opacity-100"}
        ${isFocusing ? "relative" : ""}
      `}
    >
      {isFocusing && (
        <motion.div
          className="absolute inset-0 rounded-xl"
          animate={{
            boxShadow: [
              "0 0 0 0px rgba(59, 130, 246, 0)",
              "0 0 0 4px rgba(59, 130, 246, 0.5)",
              "0 0 0 0px rgba(59, 130, 246, 0)",
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      <div
        className={`
          rounded-xl p-4
          bg-white/5 backdrop-blur-sm
          ${
            isFocusing
              ? "border-2 border-primary ring-2 ring-primary/50 bg-primary/10"
              : "border border-white/10"
          }
          hover:bg-white/10 hover:border-white/20
          hover:shadow-lg hover:shadow-primary/5
          cursor-grab active:cursor-grabbing
          transition-all duration-200
          group
          relative
        `}
        onClick={handleClick}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-bold line-clamp-2 flex-1 min-w-0">
              {task.title}
            </h4>
            <div className="flex items-center gap-1 shrink-0">
              {isToday && !isFocusing && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20"
                  onClick={handleStartFocus}
                  title="Bắt đầu Focus"
                >
                  <Play className="h-3 w-3" fill="currentColor" />
                </Button>
              )}

              {isFocusing && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="flex items-center gap-1 text-primary text-xs font-medium px-2 py-0.5 bg-primary/20 rounded-full"
                >
                  {focusType === "STANDARD"
                    ? `Phiên ${currentSession}/${totalSessions}`
                    : focusStatus === "focusing"
                      ? "Đang Focus"
                      : focusStatus === "break"
                        ? "Nghỉ"
                        : "Tạm Dừng"}
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                </motion.div>
              )}

              {task.priority && (
                <Badge
                  className={`
                    ${priorityConfig[task.priority].bg}
                    ${priorityConfig[task.priority].text}
                    border-0 text-xs font-medium px-2 py-0.5
                  `}
                >
                  {priorityConfig[task.priority].label}
                </Badge>
              )}
            </div>
          </div>

          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}

          {shouldShowProgress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {isFocusing && focusType === "STANDARD"
                    ? `🎯 Đang Focus: ${displayCompletedSessions} / ${displayTotalSessions}`
                    : `📊 Tiến Độ: ${displayCompletedSessions} / ${displayTotalSessions}`}
                </span>
                <span>{Math.round(sessionProgress)}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${sessionProgress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    isFocusing && focusType === "STANDARD"
                      ? "bg-linear-to-r from-blue-500 to-blue-600"
                      : "bg-linear-to-r from-green-500 to-emerald-600"
                  }`}
                />
              </div>
            </div>
          )}

          {hasQuickSessions && (
            <div className="flex items-center gap-1.5 text-xs text-yellow-400/80">
              <Zap className="h-3 w-3" />
              <span>
                ⚡ {task.focusCompletedSessions} phiên Quick hoàn thành
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3 text-xs text-muted-foreground/60 min-w-0 flex-wrap">
              {task.suggestedSessionType === "QUICK_5" && (
                <div
                  className="flex items-center gap-1 text-yellow-400/80"
                  title="AI gợi ý: Quick 5 phút"
                >
                  <Zap className="h-3 w-3" />
                  <span>⚡ Quick 5p</span>
                </div>
              )}
              {task.suggestedSessionType === "QUICK_25" && (
                <div
                  className="flex items-center gap-1 text-purple-400/80"
                  title="AI gợi ý: Quick 25 phút"
                >
                  <Zap className="h-3 w-3" />
                  <span>⚡ Quick 25p</span>
                </div>
              )}
              {task.suggestedSessionType === "STANDARD" &&
                task.estimatedPomodoros &&
                task.estimatedPomodoros > 0 && (
                  <div
                    className="flex items-center gap-1 text-green-400/80"
                    title={`AI gợi ý: ${task.estimatedPomodoros} phiên Pomodoro`}
                  >
                    <Clock className="h-3 w-3" />
                    <span>🍅 {task.estimatedPomodoros} pomodoros</span>
                  </div>
                )}
              {!task.suggestedSessionType &&
                task.estimatedPomodoros &&
                task.estimatedPomodoros > 0 && (
                  <div
                    className="flex items-center gap-1 text-primary/70"
                    title="AI ước lượng"
                  >
                    <Clock className="h-3 w-3" />
                    <span>~{task.estimatedPomodoros} 🍅</span>
                  </div>
                )}

              {task.dueDate && (
                <div className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  <span>
                    {new Date(task.dueDate).toLocaleDateString("vi-VN")}
                  </span>
                </div>
              )}

              {showCreatedDate && task.createdAt && (
                <div className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  <span>
                    Tạo: {new Date(task.createdAt).toLocaleDateString("vi-VN")}
                  </span>
                </div>
              )}
            </div>

            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 shrink-0">
                {task.tags.slice(0, 2).map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-xs px-2 py-0 h-5 bg-white/5 border-white/10"
                  >
                    {tag}
                  </Badge>
                ))}
                {task.tags.length > 2 && (
                  <Badge
                    variant="outline"
                    className="text-xs px-2 py-0 h-5 bg-white/5 border-white/10"
                  >
                    +{task.tags.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
