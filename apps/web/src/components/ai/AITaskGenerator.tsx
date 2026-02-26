"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import {
  Sparkles,
  Loader2,
  Check,
  Clock,
  Brain,
  Wand2,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────────
interface FocusPlan {
  sessionType: string; // "QUICK_5" | "QUICK_25" | "STANDARD"
  sessions: number;
  totalMinutes: number;
  label: string;
}

interface GeneratedTask {
  title: string;
  description: string;
  priority: string;
  estimatedPomodoros: number;
  reasoning: string;
  order: number;
  tags: string[];
  focusPlan: FocusPlan;
  selected: boolean; // UI-only: user can toggle
}

interface GenerateResponse {
  tasks: Omit<GeneratedTask, "selected">[];
  summary: string;
}

interface AITaskGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTasksCreated: () => void; // refresh kanban after tasks created
}

// ── Priority badge helper ───────────────────────────────────────────────────────
const priorityConfig: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  HIGH: {
    color: "text-orange-400",
    bg: "bg-orange-500/20 border-orange-500/30",
    label: "Cao",
  },
  MEDIUM: {
    color: "text-yellow-400",
    bg: "bg-yellow-500/20 border-yellow-500/30",
    label: "TB",
  },
  LOW: {
    color: "text-blue-400",
    bg: "bg-blue-500/20 border-blue-500/30",
    label: "Thấp",
  },
  URGENT: {
    color: "text-red-400",
    bg: "bg-red-500/20 border-red-500/30",
    label: "Khẩn",
  },
};


export function AITaskGenerator({
  open,
  onOpenChange,
  onTasksCreated,
}: AITaskGeneratorProps) {
  const [step, setStep] = useState<"input" | "review" | "creating">("input");
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [maxTasks, setMaxTasks] = useState(5);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<GeneratedTask[]>([]);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  const reset = () => {
    setStep("input");
    setGoal("");
    setContext("");
    setMaxTasks(5);
    setTasks([]);
    setSummary("");
    setError("");
    setLoading(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  // Step 1: Call AI to generate tasks
  const handleGenerate = async () => {
    if (!goal.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await api.post<GenerateResponse>("/ai/generate-tasks", {
        goal: goal.trim(),
        context: context.trim() || undefined,
        maxTasks,
      });

      setTasks(
        (res.tasks || []).map((t) => ({
          ...t,
          selected: true,
        })),
      );
      setSummary(res.summary || "");
      setStep("review");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Confirm selected tasks
  const handleConfirm = async () => {
    const selectedTasks = tasks.filter((t) => t.selected);
    if (selectedTasks.length === 0) return;

    setStep("creating");
    try {
      await api.post("/ai/confirm-tasks", {
        tasks: selectedTasks.map((t) => ({
          title: t.title,
          description: t.description,
          priority: t.priority,
          estimatedPomodoros: t.estimatedPomodoros,
          order: t.order,
          tags: t.tags || [],
          suggestedSessionType: t.focusPlan?.sessionType || null,
          suggestedSessions: t.focusPlan?.sessions || null,
          suggestedTotalMinutes: t.focusPlan?.totalMinutes || null,
        })),
      });
      onTasksCreated();
      handleClose(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi tạo tasks";
      setError(msg);
      setStep("review");
    }
  };

  const toggleTask = (idx: number) => {
    setTasks((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, selected: !t.selected } : t)),
    );
  };

  const selectedCount = tasks.filter((t) => t.selected).length;
  const totalPomodoros = tasks
    .filter((t) => t.selected)
    .reduce((sum, t) => sum + t.estimatedPomodoros, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl backdrop-blur-2xl bg-background/90 border-white/20 shadow-2xl shadow-primary/10">
        <AnimatePresence mode="wait">
          {/* ─── Step 1: Input ─────────────────────────────────────── */}
          {step === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="p-6"
            >
              <DialogHeader className="pb-4">
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2 rounded-xl bg-primary/20">
                    <Wand2 className="w-5 h-5 text-primary" />
                  </div>
                  <DialogTitle className="text-xl">
                    AI Task Generator
                  </DialogTitle>
                </div>
                <DialogDescription>
                  Mô tả mục tiêu của bạn — AI sẽ phân tích và tạo ra các nhiệm
                  vụ cụ thể với ước lượng thời gian.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="goal" className="text-sm font-medium">
                    Mục tiêu / Dự án *
                  </Label>
                  <Input
                    id="goal"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="VD: Lập tài khoản shopee và đăng bán sản phẩm"
                    className="bg-white/5 border-white/10 focus:border-primary/50 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) handleGenerate();
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="context" className="text-sm font-medium">
                    Bối cảnh thêm{" "}
                    <span className="text-muted-foreground">(tùy chọn)</span>
                  </Label>
                  <Textarea
                    id="context"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="VD: Tôi đã có tài khoản facebook nhưng chưa biết cách tạo gian hàng trên shopee. Tôi muốn tập trung vào việc học cách đăng bán sản phẩm và tối ưu hóa bài đăng để thu hút khách hàng."
                    className="bg-white/5 border-white/10 focus:border-primary/50 transition-all min-h-20"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Label className="text-sm font-medium whitespace-nowrap">
                    Số tasks
                  </Label>
                  <div className="flex gap-1">
                    {[3, 5, 7].map((n) => (
                      <Button
                        key={n}
                        variant={maxTasks === n ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMaxTasks(n)}
                        className="w-10 h-8"
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                  </motion.div>
                )}
              </div>

              <DialogFooter className="mt-6">
                <Button
                  variant="outline"
                  onClick={() => handleClose(false)}
                  className="mr-auto"
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={!goal.trim() || loading}
                  className="gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang phân tích...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Tạo nhiệm vụ
                    </>
                  )}
                </Button>
              </DialogFooter>
            </motion.div>
          )}

          {/* ─── Step 2: Review ────────────────────────────────────── */}
          {step === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="p-6"
            >
              <DialogHeader className="pb-3">
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2 rounded-xl bg-primary/20">
                    <Brain className="w-5 h-5 text-primary" />
                  </div>
                  <DialogTitle className="text-xl">
                    AI đề xuất {tasks.length} nhiệm vụ
                  </DialogTitle>
                </div>
                {summary && (
                  <DialogDescription className="text-sm">
                    {summary}
                  </DialogDescription>
                )}
              </DialogHeader>

              {/* Task list */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {tasks.map((task, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    onClick={() => toggleTask(idx)}
                    className={`
                      group relative p-3 rounded-xl border cursor-pointer
                      transition-all duration-200
                      ${
                        task.selected
                          ? "bg-primary/5 border-primary/30 shadow-sm"
                          : "bg-white/3 border-white/10 opacity-50"
                      }
                      hover:border-primary/40
                    `}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <div
                        className={`
                        mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center
                        transition-all shrink-0
                        ${task.selected ? "bg-primary border-primary" : "border-white/20"}
                      `}
                      >
                        {task.selected && (
                          <Check className="w-3 h-3 text-primary-foreground" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Title + Priority + Order */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground font-mono">
                            #{task.order}
                          </span>
                          <span className="font-medium text-sm truncate">
                            {task.title}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${priorityConfig[task.priority]?.bg || ""} ${priorityConfig[task.priority]?.color || ""}`}
                          >
                            {priorityConfig[task.priority]?.label ||
                              task.priority}
                          </Badge>
                        </div>

                        {/* Description */}
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">
                            {task.description}
                          </p>
                        )}

                        {/* Metadata */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {task.estimatedPomodoros} pomodoro
                            {task.estimatedPomodoros > 1 ? "s" : ""}
                          </span>
                          {task.reasoning && (
                            <span
                              className="flex items-center gap-1 max-w-[300px] truncate"
                              title={task.reasoning}
                            >
                              <Brain className="w-3 h-3 shrink-0" />
                              <span className="truncate">{task.reasoning}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Summary bar */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10 text-sm">
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>
                    <strong className="text-foreground">{selectedCount}</strong>{" "}
                    / {tasks.length} được chọn
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />~{totalPomodoros * 25} phút
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep("input")}
                  >
                    Quay lại
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirm}
                    disabled={selectedCount === 0}
                    className="gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Tạo {selectedCount} tasks
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 mt-3 rounded-lg bg-destructive/10 text-destructive text-sm"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ─── Step 3: Creating ──────────────────────────────────── */}
          {step === "creating" && (
            <motion.div
              key="creating"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-12 flex flex-col items-center justify-center gap-4"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <motion.div
                  className="absolute -inset-2 rounded-full border-2 border-primary/20"
                  animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <p className="text-muted-foreground">
                Đang tạo {selectedCount} nhiệm vụ...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
