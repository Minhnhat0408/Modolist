"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import type { Task } from "@/types/database";
import { TaskStatus, TaskPriority } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const taskFormSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống").max(200),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueDate: z.string().optional(),
  tags: z.string().optional(),
  estimatedPomodoros: z.number().min(1).optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<Task>) => void;
  onDelete?: () => void;
  task?: Task;
  defaultStatus?: TaskStatus;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  task,
  defaultStatus = TaskStatus.BACKLOG,
}: TaskFormDialogProps) {
  const isEditing = !!task;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      status: task?.status || defaultStatus,
      priority: task?.priority || TaskPriority.MEDIUM,
      dueDate: task?.dueDate
        ? new Date(task.dueDate).toISOString().split("T")[0]
        : "",
      tags: task?.tags?.join(", ") || "",
      estimatedPomodoros: task?.estimatedPomodoros || 1,
    },
  });

  const currentStatus = watch("status");
  const currentPriority = watch("priority");

  useEffect(() => {
    if (open) {
      reset({
        title: task?.title || "",
        description: task?.description || "",
        status: task?.status || defaultStatus,
        priority: task?.priority || TaskPriority.MEDIUM,
        dueDate: task?.dueDate
          ? new Date(task.dueDate).toISOString().split("T")[0]
          : "",
        tags: task?.tags?.join(", ") || "",
        estimatedPomodoros: task?.estimatedPomodoros || 1,
      });
    }
  }, [open, task, defaultStatus, reset]);

  const handleFormSubmit = (data: TaskFormData) => {
    const submitData: Partial<Task> = {
      ...data,
      tags: data.tags
        ? data.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    };

    onSubmit(submitData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          sm:max-w-150
          backdrop-blur-2xl
          bg-background/80
          border-white/20
          shadow-2xl shadow-primary/10
        "
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            >
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {isEditing ? "Chỉnh sửa nhiệm vụ" : "Tạo nhiệm vụ mới"}
                </DialogTitle>
              </DialogHeader>

              <form
                onSubmit={handleSubmit(handleFormSubmit)}
                className="space-y-5 mt-6"
              >
                  {/* Title */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="title" className="text-sm font-medium">
                      Tiêu đề *
                    </Label>
                    <Input
                      id="title"
                      {...register("title")}
                      placeholder="Nhập tiêu đề nhiệm vụ"
                      className="
                        bg-white/5 border-white/10
                        focus:bg-white/10 focus:border-primary/50
                        transition-all duration-200
                      "
                    />
                    {errors.title && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-destructive"
                      >
                        {errors.title.message}
                      </motion.p>
                    )}
                  </motion.div>

                  {/* Description */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="description" className="text-sm font-medium">
                      Mô tả
                    </Label>
                    <Textarea
                      id="description"
                      {...register("description")}
                      placeholder="Mô tả chi tiết nhiệm vụ"
                      className="
                        bg-white/5 border-white/10
                        focus:bg-white/10 focus:border-primary/50
                        transition-all duration-200
                        min-h-25
                      "
                    />
                  </motion.div>

                  {/* Status & Priority */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="status" className="text-sm font-medium">
                        Trạng thái
                      </Label>
                      <Select
                        value={currentStatus}
                        onValueChange={(value) =>
                          setValue("status", value as TaskStatus)
                        }
                      >
                        <SelectTrigger
                          id="status"
                          className="
                            bg-white/5 border-white/10
                            focus:bg-white/10 focus:border-primary/50
                            transition-all duration-200
                          "
                        >
                          <SelectValue placeholder="Chọn trạng thái" />
                        </SelectTrigger>
                        <SelectContent className="bg-background/95 backdrop-blur-xl border-white/20">
                          <SelectItem value={TaskStatus.BACKLOG}>
                            Danh sách chờ
                          </SelectItem>
                          <SelectItem value={TaskStatus.TODAY}>Hôm nay</SelectItem>
                          <SelectItem value={TaskStatus.DONE}>
                            Hoàn thành
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="priority" className="text-sm font-medium">
                        Độ ưu tiên
                      </Label>
                      <Select
                        value={currentPriority}
                        onValueChange={(value) =>
                          setValue("priority", value as TaskPriority)
                        }
                      >
                        <SelectTrigger
                          id="priority"
                          className="
                            bg-white/5 border-white/10
                            focus:bg-white/10 focus:border-primary/50
                            transition-all duration-200
                          "
                        >
                          <SelectValue placeholder="Chọn độ ưu tiên" />
                        </SelectTrigger>
                        <SelectContent className="bg-background/95 backdrop-blur-xl border-white/20">
                          <SelectItem value={TaskPriority.LOW}>Thấp</SelectItem>
                          <SelectItem value={TaskPriority.MEDIUM}>
                            Trung bình
                          </SelectItem>
                          <SelectItem value={TaskPriority.HIGH}>Cao</SelectItem>
                          <SelectItem value={TaskPriority.URGENT}>
                            Khẩn cấp
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </motion.div>

                  {/* Due Date */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="dueDate" className="text-sm font-medium">
                      Hạn hoàn thành
                    </Label>
                    <Input
                      id="dueDate"
                      type="date"
                      {...register("dueDate")}
                      className="
                        bg-white/5 border-white/10
                        focus:bg-white/10 focus:border-primary/50
                        transition-all duration-200
                      "
                    />
                  </motion.div>

                  {/* Tags */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="tags" className="text-sm font-medium">
                      Nhãn (phân cách bằng dấu phẩy)
                    </Label>
                    <Input
                      id="tags"
                      {...register("tags")}
                      placeholder="công việc, khẩn cấp, họp"
                      className="
                        bg-white/5 border-white/10
                        focus:bg-white/10 focus:border-primary/50
                        transition-all duration-200
                      "
                    />
                  </motion.div>

                  {/* Estimated Pomodoros */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 }}
                    className="space-y-2"
                  >
                    <Label
                      htmlFor="estimatedPomodoros"
                      className="text-sm font-medium"
                    >
                      Số Pomodoro dự kiến
                    </Label>
                    <Input
                      id="estimatedPomodoros"
                      type="number"
                      min="1"
                      {...register("estimatedPomodoros", { valueAsNumber: true })}
                      className="
                        bg-white/5 border-white/10
                        focus:bg-white/10 focus:border-primary/50
                        transition-all duration-200
                      "
                    />
                  </motion.div>

                  {/* Footer */}
                  <DialogFooter className="gap-2 mt-8">
                    {isEditing && onDelete && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={onDelete}
                          disabled={isSubmitting}
                          className="backdrop-blur-sm"
                        >
                          Xóa
                        </Button>
                      </motion.div>
                    )}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.45 }}
                    >
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="backdrop-blur-sm"
                      >
                        {isSubmitting
                          ? "Đang lưu..."
                          : isEditing
                            ? "Cập nhật"
                            : "Tạo"}
                      </Button>
                    </motion.div>
                  </DialogFooter>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    );
  }
