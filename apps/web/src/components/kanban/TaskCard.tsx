"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { KanbanTask } from "@/types/kanban";
import { TaskPriority } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";

interface TaskCardProps {
  task: KanbanTask;
  onEdit?: (task: KanbanTask) => void;
  showCreatedDate?: boolean;
}

export function TaskCard({ task, onEdit, showCreatedDate }: TaskCardProps) {
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

  const handleClick = () => {
    if (onEdit) {
      onEdit(task);
    }
  };

  const progress =
    task.estimatedPomodoros && task.estimatedPomodoros > 0
      ? ((task.completedPomodoros || 0) / task.estimatedPomodoros) * 100
      : 0;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`${isDragging ? "opacity-40" : "opacity-100"}`}
    >
      <div
        className="
          rounded-xl p-4
          bg-white/5 backdrop-blur-sm
          border border-white/10
          hover:bg-white/10 hover:border-white/20
          hover:shadow-lg hover:shadow-primary/5
          cursor-grab active:cursor-grabbing
          transition-all duration-200
          group
        "
        onClick={handleClick}
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm  font-bold line-clamp-2 flex-1">
              {task.title}
            </h4>
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

          {/* Description */}
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Pomodoro Progress Bar */}
          {task.estimatedPomodoros && task.estimatedPomodoros > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {task.completedPomodoros || 0}/{task.estimatedPomodoros}{" "}
                  Pomodoros
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full bg-linear-to-r from-primary to-secondary rounded-full"
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            {/* Dates */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
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

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
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
