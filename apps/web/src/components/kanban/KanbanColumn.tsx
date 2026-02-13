"use client";

import { useDroppable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { KanbanTask } from "@/types/kanban";
import { TaskStatus } from "@/types/database";
import { TaskCard } from "./TaskCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Play } from "lucide-react";
import clsx from "clsx";

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: KanbanTask[];
  color: string;
  onAddTask?: (status: TaskStatus) => void;
  onEditTask?: (task: KanbanTask) => void;
  onStartFocus?: (task: KanbanTask) => void;
}

export function KanbanColumn({
  status,
  title,
  tasks,
  color,
  onAddTask,
  onEditTask,
  onStartFocus,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const isToday = status === TaskStatus.TODAY;

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
                {tasks.length}
              </Badge>
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
                className="w-full mb-4 bg-primary/20 hover:bg-primary/30 border border-primary/30 backdrop-blur-sm group relative overflow-hidden"
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
                  className="absolute inset-0 bg-primary/10"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <Play className="mr-2 h-5 w-5" />
                <span className="relative z-10">Bắt đầu Focus Mode</span>
              </Button>
            </motion.div>
          )}
        </div>

        <div className="px-4 pb-10 pt-0 space-y-3 min-h-50">
          {tasks.map((task, index) => (
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
                showCreatedDate={status === TaskStatus.BACKLOG}
              />
            </motion.div>
          ))}

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
      </div>
    </motion.div>
  );
}
