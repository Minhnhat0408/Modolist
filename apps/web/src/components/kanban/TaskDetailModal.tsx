"use client";

/**
 * TaskDetailModal — view + inline-editing detail panel for a task.
 *
 * Design:
 * - Opens when user clicks a task card (read / view mode by default).
 * - Each field has a hover affordance → click → inline edit input.
 * - onBlur / onChange auto-saves the changed field via API PATCH (optimistic).
 * - No "Save" / "Cancel" button needed.
 * - Delete button in footer.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import type { Task } from "@/types/database";
import { TaskStatus, TaskPriority } from "@/types/database";
import { api } from "@/lib/api-client";
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "@/components/ui/responsive-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlignLeft,
  Brain,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Loader2,
  Pencil,
  RotateCcw,
  Sparkles,
  Tag,
  Trash2,
  Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────

type AISuggestion = {
  estimatedPomodoros?: number;
  reasoning?: string;
  confidence?: string;
  focusPlan?: {
    sessionType: string;
    sessions: number;
    totalMinutes: number;
    label: string;
  };
};

type SessionHistoryItem = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  plannedDuration: number;
  duration: number | null;
  status: string;
};

// ── Session history helpers ─────────────────────────────────
function sessionTypeInfo(plannedDuration: number) {
  if (plannedDuration <= 300) return { label: "Quick 5p", color: "#f59e0b" };
  if (plannedDuration <= 900) return { label: "Quick 15p", color: "#8b5cf6" };
  return { label: "Standard 25p", color: "#3b82f6" };
}
function formatSessionDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface TaskDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  /** Called optimistically when any field is saved — sync to parent list */
  onTaskUpdated: (taskId: string, data: Partial<Task>) => void;
  /** Called after successful delete — remove from parent list */
  onTaskDeleted: (taskId: string) => void;
}

// ── Priority config ───────────────────────────────────────────────────

const PRIORITY_OPTIONS = [
  {
    value: TaskPriority.URGENT,
    label: "🔴 Khẩn cấp",
    cls: "bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25",
  },
  {
    value: TaskPriority.HIGH,
    label: "🟠 Cao",
    cls: "bg-orange-500/15 text-orange-400 border-orange-500/25 hover:bg-orange-500/25",
  },
  {
    value: TaskPriority.MEDIUM,
    label: "🟡 Trung bình",
    cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25 hover:bg-yellow-500/25",
  },
  {
    value: TaskPriority.LOW,
    label: "🔵 Thấp",
    cls: "bg-blue-500/15 text-blue-400 border-blue-500/25 hover:bg-blue-500/25",
  },
] as const;

function getPriorityOption(p: TaskPriority | undefined) {
  return (
    PRIORITY_OPTIONS.find((o) => o.value === (p ?? TaskPriority.MEDIUM)) ??
    PRIORITY_OPTIONS[2]
  );
}

// ── Due-date formatter ────────────────────────────────────────────────

function formatDueDate(
  d: Date | string | null,
): { text: string; cls: string } | null {
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(d);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (diff < 0)
    return {
      text: `Quá hạn ${Math.abs(diff)} ngày`,
      cls: "text-red-400 font-medium",
    };
  if (diff === 0)
    return { text: "Hôm nay", cls: "text-orange-400 font-medium" };
  if (diff === 1) return { text: "Ngày mai", cls: "text-yellow-400" };
  return {
    text: date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    cls: "text-muted-foreground",
  };
}

// ── Section label ─────────────────────────────────────────────────────

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </p>
  );
}

// ── Inline editable text (single-line or textarea) ────────────────────

interface EditableTextProps {
  value: string | null | undefined;
  placeholder: string;
  onSave: (val: string | null) => void;
  multiline?: boolean;
  large?: boolean;
  className?: string;
}

function EditableText({
  value,
  placeholder,
  onSave,
  multiline = false,
  large = false,
  className,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const startEdit = () => {
    setDraft(value ?? "");
    setEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      textareaRef.current?.focus();
    }, 0);
  };

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== (value?.trim() ?? "")) {
      onSave(trimmed || null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setEditing(false);
    if (!multiline && e.key === "Enter") (e.target as HTMLElement).blur();
  };

  const inputCls = cn(
    "w-full bg-white/5 border border-primary/40 rounded-xl px-3 py-2 outline-none focus:border-primary/60 transition-colors",
    large ? "text-lg font-bold" : "text-sm",
    multiline && "resize-none leading-relaxed",
  );

  if (editing) {
    return multiline ? (
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        rows={3}
        className={cn(inputCls, className)}
        autoFocus
      />
    ) : (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={cn(inputCls, className)}
        autoFocus
      />
    );
  }

  return (
    <div
      onClick={startEdit}
      className={cn(
        "group flex items-start justify-between gap-2 cursor-text rounded-xl px-3 py-2 hover:bg-white/5 transition-colors",
        className,
      )}
    >
      <span
        className={cn(
          "flex-1 wrap-break-word min-w-0 leading-relaxed",
          large ? "text-lg font-bold" : "text-sm",
          !value && "text-muted-foreground/40 italic",
          multiline && "whitespace-pre-wrap",
        )}
      >
        {value || placeholder}
      </span>
      <Pencil className="h-3.5 w-3.5 shrink-0 mt-0.5 text-transparent group-hover:text-muted-foreground/40 transition-colors" />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export function TaskDetailModal({
  open,
  onOpenChange,
  task,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailModalProps) {
  const [localTask, setLocalTask] = useState<Task | null>(null);
  const [editingPriority, setEditingPriority] = useState(false);
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [tagsDraft, setTagsDraft] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [aiEstimating, setAiEstimating] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>(
    [],
  );
  const [loadingHistory, setLoadingHistory] = useState(false);
  const prevTaskIdRef = useRef<string | null>(null);

  // Sync when modal opens or task changes
  useEffect(() => {
    if (open && task) {
      const isNewTask = prevTaskIdRef.current !== task.id;
      prevTaskIdRef.current = task.id;
      setLocalTask({ ...task });
      setEditingPriority(false);
      setEditingDueDate(false);
      setEditingTags(false);
      if (isNewTask) {
        setAiSuggestion(null);
        setSessionsOpen(false);
        setSessionHistory([]);
      }
    }
    if (!open) {
      prevTaskIdRef.current = null;
      setLocalTask(null);
    }
  }, [open, task]);

  // ── Session history ─────────────────────────────────────────
  const loadSessionHistory = useCallback(async () => {
    if (!localTask) return;
    setLoadingHistory(true);
    try {
      const data = await api.get<SessionHistoryItem[]>(
        `/focus-sessions/by-task/${localTask.id}`,
      );
      setSessionHistory(data);
    } catch (e) {
      console.error("Failed to load session history", e);
    } finally {
      setLoadingHistory(false);
    }
  }, [localTask]);

  const toggleSessionHistory = useCallback(() => {
    if (!sessionsOpen && sessionHistory.length === 0) {
      loadSessionHistory();
    }
    setSessionsOpen((v) => !v);
  }, [sessionsOpen, sessionHistory.length, loadSessionHistory]);

  // Optimistic patch + API call
  const patchField = useCallback(
    async (field: string, value: unknown) => {
      if (!localTask) return;
      const update = { [field]: value } as Partial<Task>;
      setLocalTask((p) => (p ? { ...p, ...update } : p));
      onTaskUpdated(localTask.id, update);
      try {
        await api.patch(`/tasks/${localTask.id}`, { [field]: value });
      } catch (e) {
        // Revert to original on error
        const orig = (task as unknown as Record<string, unknown>)[field];
        setLocalTask((p) => (p ? { ...p, [field]: orig } : p));
        console.error("Failed to save:", field, e);
      }
    },
    [localTask, task, onTaskUpdated],
  );

  const handleDelete = async () => {
    if (!localTask) return;
    setDeleting(true);
    try {
      await api.delete(`/tasks/${localTask.id}`);
      onTaskDeleted(localTask.id);
      onOpenChange(false);
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleting(false);
    }
  };

  const handleAIEstimate = async () => {
    if (!localTask) return;
    setAiEstimating(true);
    setAiSuggestion(null);
    try {
      const result = await api.post<AISuggestion>("/ai/estimate-time", {
        taskTitle: localTask.title,
        taskDescription: localTask.description || undefined,
      });
      console.log(result);
      setAiSuggestion(result);
      if (result.estimatedPomodoros) {
        await patchField("estimatedPomodoros", result.estimatedPomodoros);
      }
      if (result.focusPlan) {
        await patchField("suggestedSessionType", result.focusPlan.sessionType);
        await patchField("suggestedSessions", result.focusPlan.sessions);
        await patchField(
          "suggestedTotalMinutes",
          result.focusPlan.totalMinutes,
        );
      }
    } catch (e) {
      console.error("AI estimate failed:", e);
    } finally {
      setAiEstimating(false);
    }
  };

  const handleSaveTags = () => {
    setEditingTags(false);
    const tags = tagsDraft
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (JSON.stringify(tags) !== JSON.stringify(localTask?.tags ?? [])) {
      patchField("tags", tags);
    }
  };

  if (!localTask) return null;

  const isDone = localTask.status === TaskStatus.DONE;
  const dueInfo = formatDueDate(localTask.dueDate);
  const priorityOpt = getPriorityOption(localTask.priority);

  // ── DONE = read-only "history" view ─────────────────────────────────
  if (isDone) {
    return (
      <ResponsiveModal open={open} onOpenChange={onOpenChange}>
        <ResponsiveModalContent
          dialogClassName="sm:max-w-lg bg-background/95 backdrop-blur-2xl border-white/15 shadow-2xl"
          className="gap-0 p-0"
        >
          <ResponsiveModalTitle className="sr-only">
            {localTask.title}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            Lịch sử nhiệm vụ
          </ResponsiveModalDescription>

          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-white/10 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground/55 mb-2">
              <span>✅ Hoàn thành</span>
              <span>·</span>
              <span>
                {localTask.completedAt
                  ? new Date(localTask.completedAt).toLocaleDateString(
                      "vi-VN",
                      {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )
                  : new Date(localTask.updatedAt).toLocaleDateString("vi-VN")}
              </span>
            </div>
            <h2 className="text-lg font-bold px-3 -mx-3 py-1">
              {localTask.title}
            </h2>
          </div>

          {/* Body */}
          <ResponsiveModalBody className="px-6 py-4 space-y-5 overflow-y-auto max-h-[55dvh] md:max-h-[58vh]">
            {/* Description */}
            {localTask.description && (
              <section>
                <SectionLabel icon={AlignLeft}>Mô tả</SectionLabel>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground px-1">
                  {localTask.description}
                </p>
              </section>
            )}

            {/* Tags */}
            {localTask.tags && localTask.tags.length > 0 && (
              <section>
                <SectionLabel icon={Tag}>Nhãn</SectionLabel>
                <div className="flex items-center gap-1.5 flex-wrap px-1">
                  {localTask.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-xs px-2 py-0 h-5 bg-white/5 border-white/15"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Focus stats */}
            <section>
              <SectionLabel icon={Clock}>Thống kê Focus</SectionLabel>
              <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground/80 px-1">
                {localTask.completedPomodoros > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">
                      {localTask.completedPomodoros}
                    </span>{" "}
                    phiên Pomodoro hoàn thành
                  </span>
                ) : (
                  <span className="text-muted-foreground/50 italic text-xs">
                    Chưa có phiên Focus nào
                  </span>
                )}
                {localTask.estimatedPomodoros ? (
                  <span className="flex items-center gap-1 text-xs">
                    <Clock className="h-3.5 w-3.5 text-green-400" />
                    Ước lượng: {localTask.estimatedPomodoros} pomodoros
                  </span>
                ) : null}
              </div>
              {/* Expandable session history */}
              {localTask.completedPomodoros > 0 && (
                <div className="mt-2.5 px-1">
                  <button
                    onClick={toggleSessionHistory}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        sessionsOpen ? "rotate-180" : ""
                      }`}
                    />
                    {sessionsOpen ? "Ẩn" : "Xem"} lịch sử
                  </button>
                  {sessionsOpen && (
                    <div className="mt-2 space-y-1">
                      {loadingHistory ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Đang tải...
                        </div>
                      ) : sessionHistory.length === 0 ? (
                        <p className="text-xs text-muted-foreground/40 italic">
                          Chưa có dữ liệu
                        </p>
                      ) : (
                        sessionHistory.map((s) => {
                          const { label, color } = sessionTypeInfo(
                            s.plannedDuration,
                          );
                          const startDate = new Date(s.startedAt);
                          return (
                            <div
                              key={s.id}
                              className="flex items-center gap-2 py-1 rounded-lg text-xs"
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <span
                                className="font-medium w-20 shrink-0 text-[11px]"
                                style={{ color }}
                              >
                                {label}
                              </span>
                              <span className="text-muted-foreground/60 flex-1 text-[11px]">
                                {startDate.toLocaleDateString("vi-VN")}{" "}
                                {startDate.toLocaleTimeString("vi-VN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span className="text-muted-foreground/60 w-12 text-right text-[11px]">
                                {formatSessionDuration(s.duration)}
                              </span>
                              <span
                                className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] ${
                                  s.status === "COMPLETED"
                                    ? "bg-green-500/15 text-green-400"
                                    : s.status === "INTERRUPTED"
                                      ? "bg-red-500/15 text-red-400"
                                      : "bg-yellow-500/15 text-yellow-400"
                                }`}
                              >
                                {s.status === "COMPLETED"
                                  ? "✓"
                                  : s.status === "INTERRUPTED"
                                    ? "✗"
                                    : "…"}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Priority + Due date (read-only) */}
            <div className="flex items-center gap-4 px-1">
              <Badge
                variant="outline"
                className={cn("text-xs", priorityOpt.cls)}
              >
                {priorityOpt.label}
              </Badge>
              {dueInfo && (
                <span
                  className={cn("text-xs flex items-center gap-1", dueInfo.cls)}
                >
                  <CalendarDays className="h-3 w-3" />
                  {dueInfo.text}
                </span>
              )}
            </div>
          </ResponsiveModalBody>

          {/* Footer — restore button */}
          <div className="px-6 py-4 border-t border-white/10 flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => patchField("status", TaskStatus.TODAY)}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Khôi phục về Hôm nay
            </Button>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    );
  }

  // ── Default: editable view for BACKLOG / TODAY ──────────────────────

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        dialogClassName="sm:max-w-lg bg-background/95 backdrop-blur-2xl border-white/15 shadow-2xl"
        className="gap-0 p-0"
      >
        {/* Accessible title/description for screen readers */}
        <ResponsiveModalTitle className="sr-only">
          {localTask.title}
        </ResponsiveModalTitle>
        <ResponsiveModalDescription className="sr-only">
          Chi tiết nhiệm vụ
        </ResponsiveModalDescription>

        {/* ── Custom Header ── */}
        <div className="px-6 pt-5 pb-4 border-b border-white/10 space-y-1">
          {/* Meta row */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground/55 mb-2">
            <span>
              {localTask.status === TaskStatus.BACKLOG
                ? "📋 Danh sách chờ"
                : localTask.status === TaskStatus.TODAY
                  ? "🎯 Hôm nay"
                  : "✅ Hoàn thành"}
            </span>
            <span>·</span>
            <span>
              {localTask.completedAt
                ? `Hoàn thành ${new Date(localTask.completedAt).toLocaleDateString("vi-VN")}`
                : `Tạo ${new Date(localTask.createdAt).toLocaleDateString("vi-VN")}`}
            </span>
          </div>

          {/* Editable title */}
          <EditableText
            value={localTask.title}
            placeholder="Nhập tiêu đề..."
            onSave={(val) => val && patchField("title", val)}
            large
            className="-mx-3"
          />
        </div>

        {/* ── Body ── */}
        <ResponsiveModalBody className="px-6 py-4 space-y-5 overflow-y-auto max-h-[55dvh] md:max-h-[58vh]">
          {/* Description */}
          <section>
            <SectionLabel icon={AlignLeft}>Mô tả</SectionLabel>
            <EditableText
              value={localTask.description}
              placeholder="Thêm mô tả chi tiết..."
              onSave={(val) => patchField("description", val)}
              multiline
              className="-mx-3"
            />
          </section>

          {/* Status quick-switch */}
          <section>
            <SectionLabel>Trạng thái</SectionLabel>
            <div className="flex gap-2">
              {[
                {
                  value: TaskStatus.BACKLOG,
                  label: "📋 Chờ",
                  activeCls: "bg-muted border-border text-foreground",
                },
                {
                  value: TaskStatus.TODAY,
                  label: "🎯 Hôm nay",
                  activeCls:
                    "bg-secondary/20 border-secondary/35 text-secondary",
                },
                {
                  value: TaskStatus.DONE,
                  label: "✅ Xong",
                  activeCls: "bg-primary/20 border-primary/35 text-primary",
                },
              ].map((s) => {
                const isActive = localTask.status === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => patchField("status", s.value)}
                    className={cn(
                      "flex-1 py-2 px-2 rounded-xl text-xs font-medium transition-all border flex items-center justify-center gap-1",
                      isActive
                        ? cn(s.activeCls, "scale-[1.03]")
                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10",
                    )}
                  >
                    {isActive && <Check className="h-3 w-3 shrink-0" />}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Priority + Due Date */}
          <div className="grid grid-cols-2 gap-5">
            {/* Priority */}
            <section>
              <SectionLabel>Độ ưu tiên</SectionLabel>
              {!editingPriority ? (
                <button
                  onClick={() => setEditingPriority(true)}
                  className="group flex items-center gap-1.5"
                >
                  <Badge
                    variant="outline"
                    className={cn("text-xs cursor-pointer", priorityOpt.cls)}
                  >
                    {priorityOpt.label}
                  </Badge>
                  <Pencil className="h-3 w-3 text-transparent group-hover:text-muted-foreground/40 transition-colors" />
                </button>
              ) : (
                <div className="flex flex-col gap-1">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        patchField("priority", opt.value);
                        setEditingPriority(false);
                      }}
                      className={cn(
                        "text-left px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        opt.value === localTask.priority
                          ? opt.cls
                          : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/8",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Due Date */}
            <section>
              <SectionLabel icon={CalendarDays}>Hạn chót</SectionLabel>
              {!editingDueDate ? (
                <button
                  onClick={() => setEditingDueDate(true)}
                  className="group flex items-center gap-1.5"
                >
                  {dueInfo ? (
                    <span className={cn("text-sm", dueInfo.cls)}>
                      {dueInfo.text}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground/40 italic">
                      Chưa đặt
                    </span>
                  )}
                  <Pencil className="h-3 w-3 text-transparent group-hover:text-muted-foreground/40 transition-colors" />
                </button>
              ) : (
                <input
                  type="date"
                  defaultValue={
                    localTask.dueDate
                      ? new Date(localTask.dueDate).toISOString().split("T")[0]
                      : ""
                  }
                  autoFocus
                  onBlur={(e) => {
                    setEditingDueDate(false);
                    const val = e.target.value;
                    patchField("dueDate", val ? new Date(val) : null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditingDueDate(false);
                    if (e.key === "Enter") (e.target as HTMLElement).blur();
                  }}
                  className="w-full bg-white/5 border border-primary/40 rounded-xl px-2 py-1.5 text-sm outline-none focus:border-primary/60 transition-colors"
                />
              )}
            </section>
          </div>

          {/* Tags */}
          <section>
            <SectionLabel icon={Tag}>Nhãn</SectionLabel>
            {!editingTags ? (
              <div
                className="group flex items-center gap-1.5 flex-wrap cursor-pointer rounded-xl py-1.5 px-1 hover:bg-white/5 transition-colors -mx-1"
                onClick={() => {
                  setTagsDraft(localTask.tags?.join(", ") ?? "");
                  setEditingTags(true);
                }}
              >
                {localTask.tags && localTask.tags.length > 0 ? (
                  localTask.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-xs px-2 py-0 h-5 bg-white/5 border-white/15"
                    >
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground/40 italic">
                    Thêm nhãn...
                  </span>
                )}
                <Pencil className="h-3 w-3 ml-1 text-transparent group-hover:text-muted-foreground/40 transition-colors" />
              </div>
            ) : (
              <input
                value={tagsDraft}
                onChange={(e) => setTagsDraft(e.target.value)}
                onBlur={handleSaveTags}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLElement).blur();
                  if (e.key === "Escape") setEditingTags(false);
                }}
                placeholder="công việc, khẩn cấp, họp"
                autoFocus
                className="w-full bg-white/5 border border-primary/40 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors"
              />
            )}
          </section>

          {/* Focus info + AI estimate */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel icon={Clock}>Thông tin Focus</SectionLabel>
              <Button
                variant="ghost"
                size="sm"
                disabled={aiEstimating}
                onClick={handleAIEstimate}
                className="h-6 px-2 text-[10px] gap-1 text-muted-foreground/60 hover:text-primary hover:bg-primary/10 -mt-0.5"
              >
                {aiEstimating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Ước lượng AI
              </Button>
            </div>
            <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground/70 px-1">
              {localTask.estimatedPomodoros ? (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-green-400" />
                  {localTask.estimatedPomodoros} pomodoros
                </span>
              ) : (
                <span className="text-muted-foreground/30 italic">
                  Chưa có ước lượng
                </span>
              )}
              {localTask.suggestedSessionType ? (
                <span className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-yellow-400" />
                  {localTask.suggestedSessionType === "QUICK_5"
                    ? "Quick 5p"
                    : localTask.suggestedSessionType === "QUICK_15"
                      ? "Quick 15p"
                      : "Pomodoro chuẩn"}
                </span>
              ) : null}
              {localTask.completedPomodoros > 0 ? (
                <span className="flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  {localTask.completedPomodoros} phiên đã focus
                </span>
              ) : null}
            </div>
            {/* Expandable session history */}
            {localTask.completedPomodoros > 0 && (
              <div className="mt-2">
                <button
                  onClick={toggleSessionHistory}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      sessionsOpen ? "rotate-180" : ""
                    }`}
                  />
                  {sessionsOpen ? "Ẩn" : "Xem"} lịch sử{" "}
                  {localTask.completedPomodoros} phiên
                </button>
                {sessionsOpen && (
                  <div className="mt-2 space-y-1">
                    {loadingHistory ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Đang tải...
                      </div>
                    ) : sessionHistory.length === 0 ? (
                      <p className="text-xs text-muted-foreground/40 italic">
                        Chưa có dữ liệu
                      </p>
                    ) : (
                      sessionHistory.map((s) => {
                        const { label, color } = sessionTypeInfo(
                          s.plannedDuration,
                        );
                        const startDate = new Date(s.startedAt);
                        return (
                          <div
                            key={s.id}
                            className="flex items-center gap-2 py-1 rounded-lg text-xs"
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span
                              className="font-medium w-20 shrink-0 text-[11px]"
                              style={{ color }}
                            >
                              {label}
                            </span>
                            <span className="text-muted-foreground/60 flex-1 text-[11px]">
                              {startDate.toLocaleDateString("vi-VN")}{" "}
                              {startDate.toLocaleTimeString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span className="text-muted-foreground/60 w-12 text-right text-[11px]">
                              {formatSessionDuration(s.duration)}
                            </span>
                            <span
                              className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] ${
                                s.status === "COMPLETED"
                                  ? "bg-green-500/15 text-green-400"
                                  : s.status === "INTERRUPTED"
                                    ? "bg-red-500/15 text-red-400"
                                    : "bg-yellow-500/15 text-yellow-400"
                              }`}
                            >
                              {s.status === "COMPLETED"
                                ? "✓"
                                : s.status === "INTERRUPTED"
                                  ? "✗"
                                  : "…"}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {/* AI suggestion result */}
            {aiSuggestion && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="mt-3 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-2"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-purple-400">
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
                      {aiSuggestion.estimatedPomodoros} pomodoros
                      {aiSuggestion.focusPlan
                        ? ` (~${aiSuggestion.focusPlan.totalMinutes} phút)`
                        : ""}
                    </span>
                  </div>
                  {aiSuggestion.focusPlan && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Zap className="h-3 w-3 text-yellow-400" />
                      <span>{aiSuggestion.focusPlan.label}</span>
                    </div>
                  )}
                </div>

                {aiSuggestion.reasoning && (
                  <p className="text-xs text-muted-foreground/70 italic">
                    {aiSuggestion.reasoning}
                  </p>
                )}
              </motion.div>
            )}
          </section>
        </ResponsiveModalBody>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 mr-auto"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Xóa nhiệm vụ
          </Button>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
