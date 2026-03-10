"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import type { Task } from "@/types/database";
import { TaskStatus, TaskPriority } from "@/types/database";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalBody,
} from "@/components/ui/responsive-modal";
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
import { api } from "@/lib/api-client";
import { Sparkles, Loader2, Clock, Zap, Brain } from "lucide-react";

const taskFormSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống").max(200),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueDate: z.string().optional(),
  tags: z.string().optional(),
  estimatedPomodoros: z.number().optional(),
  suggestedSessionType: z.string().optional(),
  suggestedSessions: z.number().optional(),
  suggestedTotalMinutes: z.number().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

interface AISuggestion {
  estimatedPomodoros: number;
  reasoning: string;
  confidence: string;
  focusPlan: {
    sessionType: string;
    sessions: number;
    totalMinutes: number;
    label: string;
  };
}

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

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

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
      });
      setAiSuggestion(null);
      setAiError(null);
    }
  }, [open, task, defaultStatus, reset]);

  const handleFormSubmit = (data: TaskFormData) => {
    const submitData: Partial<Task> & {
      suggestedSessionType?: string;
      suggestedSessions?: number;
      suggestedTotalMinutes?: number;
    } = {
      title: data.title,
      description: data.description || null,
      status: data.status,
      priority: data.priority,
      tags: data.tags
        ? data.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      estimatedPomodoros: data.estimatedPomodoros,
      suggestedSessionType: data.suggestedSessionType,
      suggestedSessions: data.suggestedSessions,
      suggestedTotalMinutes: data.suggestedTotalMinutes,
    };

    onSubmit(submitData);
    onOpenChange(false);
  };

  const handleAiAutoComplete = async () => {
    const title = watch("title");
    const description = watch("description");

    if (!title || title.trim().length === 0) {
      setAiError("Vui lòng nhập tiêu đề trước khi dùng AI");
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiSuggestion(null);

    try {
      const result = await api.post<AISuggestion>("/ai/estimate-time", {
        taskTitle: title,
        taskDescription: description || undefined,
      });
      setAiSuggestion(result);

      // Auto-fill form fields from AI response
      if (result.estimatedPomodoros) {
        setValue("estimatedPomodoros", result.estimatedPomodoros);
      }
      if (result.focusPlan) {
        setValue("suggestedSessionType", result.focusPlan.sessionType);
        setValue("suggestedSessions", result.focusPlan.sessions);
        setValue("suggestedTotalMinutes", result.focusPlan.totalMinutes);
      }
    } catch (error) {
      console.error("AI estimate failed:", error);
      setAiError("AI không khả dụng. Bạn có thể điền thủ công.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        dialogClassName="sm:max-w-150 backdrop-blur-2xl bg-background/80 border-white/20 shadow-2xl shadow-primary/10"
        className="gap-0 p-0"
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="flex flex-col max-h-[85dvh] md:max-h-none"
            >
              <ResponsiveModalHeader>
                <ResponsiveModalTitle className="text-xl">
                  {isEditing ? "Chỉnh sửa nhiệm vụ" : "Tạo nhiệm vụ mới"}
                </ResponsiveModalTitle>
                <ResponsiveModalDescription>
                  {isEditing
                    ? "Cập nhật thông tin chi tiết của nhiệm vụ."
                    : "Nhập thông tin chi tiết để tạo nhiệm vụ mới."}
                </ResponsiveModalDescription>
              </ResponsiveModalHeader>

              <ResponsiveModalBody>
              <form
                onSubmit={handleSubmit(handleFormSubmit)}
                className="space-y-5"
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
                    placeholder="Nhập tiêu đề task"
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
                    placeholder="Mô tả chi tiết task"
                    className="
                        bg-white/5 border-white/10
                        focus:bg-white/10 focus:border-primary/50
                        transition-all duration-200
                        min-h-25
                      "
                  />
                </motion.div>

                {/* AI Auto-Complete */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.17 }}
                  className="space-y-3"
                >
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAiAutoComplete}
                    disabled={aiLoading}
                    className="w-full bg-linear-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30 hover:border-purple-500/50 hover:from-purple-500/20 hover:to-blue-500/20 transition-all duration-300"
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        AI đang phân tích...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />✨ AI Ước lượng
                        thời gian
                      </>
                    )}
                  </Button>

                  {aiError && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-yellow-400/80"
                    >
                      {aiError}
                    </motion.p>
                  )}

                  {aiSuggestion && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-purple-300">
                        <Brain className="h-4 w-4" />
                        Gợi ý từ AI
                        <span className="ml-auto text-xs text-muted-foreground">
                          Độ tin cậy:{" "}
                          {aiSuggestion.confidence === "high" ? (
                            <span className="text-green-400">Cao</span>
                          ) : aiSuggestion.confidence === "medium" ? (
                            <span className="text-yellow-400">Trung bình</span>
                          ) : (
                            <span className="text-red-400">Thấp</span>
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3 w-3 text-green-400" />
                          <span>
                            {aiSuggestion.estimatedPomodoros} pomodoros (~
                            {aiSuggestion.focusPlan.totalMinutes} phút)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Zap className="h-3 w-3 text-yellow-400" />
                          <span>{aiSuggestion.focusPlan.label}</span>
                        </div>
                      </div>

                      {aiSuggestion.reasoning && (
                        <p className="text-xs text-muted-foreground/70 italic">
                          {aiSuggestion.reasoning}
                        </p>
                      )}
                    </motion.div>
                  )}
                </motion.div>

                {/* Quick Status Buttons (mobile-friendly) */}
                {isEditing && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 }}
                    className="space-y-2"
                  >
                    <Label className="text-sm font-medium">Di chuyển nhanh</Label>
                    <div className="flex gap-2">
                      {[
                        { value: TaskStatus.BACKLOG, label: "📋 Chờ", color: "bg-muted hover:bg-muted/80" },
                        { value: TaskStatus.TODAY, label: "🎯 Hôm nay", color: "bg-secondary/20 hover:bg-secondary/30 border border-secondary/30" },
                        { value: TaskStatus.DONE, label: "✅ Xong", color: "bg-primary/20 hover:bg-primary/30 border border-primary/30" },
                      ].map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setValue("status", s.value)}
                          className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                            currentStatus === s.value
                              ? `${s.color} ring-2 ring-primary/50 scale-[1.02]`
                              : "bg-white/5 hover:bg-white/10 border border-white/10"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

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
                        <SelectItem value={TaskStatus.TODAY}>
                          Hôm nay
                        </SelectItem>
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

                {/* Footer */}
                <div className="flex justify-between items-center gap-2 mt-8 pb-2">
                  {isEditing && onDelete ? (
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
                  ) : <div />}
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
                </div>
              </form>
              </ResponsiveModalBody>
            </motion.div>
          )}
        </AnimatePresence>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
