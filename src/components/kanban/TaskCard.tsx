"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { KanbanTask } from "@/types/kanban";
import { TaskPriority, TaskStatus } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Play, Clock, Zap, AlertTriangle, Copy } from "lucide-react";
import { useFocusStore } from "@/stores/useFocusStore";
import { Button } from "@/components/ui/button";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { useTranslations } from "next-intl";

// ── Session type colors ───────────────────────────────────────────────
const SESSION_COLORS = {
  QUICK_5: "#f59e0b", // amber
  QUICK_15: "#8b5cf6", // purple
  STANDARD: "#3b82f6", // blue
} as const;
type SessionColorKey = keyof typeof SESSION_COLORS;

function getSessionType(plannedDuration: number): SessionColorKey {
  if (plannedDuration <= 300) return "QUICK_5";
  if (plannedDuration <= 900) return "QUICK_15";
  return "STANDARD";
}

const SESSION_LABELS: Record<SessionColorKey, string> = {
  QUICK_5: "5p",
  QUICK_15: "15p",
  STANDARD: "25p",
};

// ── Due-date helpers ─────────────────────────────────────────────────

/** Compute how urgent a dueDate is relative to today */
function getDueDateUrgency(
  dueDate: Date | string | null,
): "overdue" | "today" | "soon" | "normal" | null {
  if (!dueDate) return null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(dueDate);
  const targetDay = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  const diffDays = Math.round(
    (targetDay.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 2) return "soon";
  return "normal";
}

const URGENCY_STYLES = {
  overdue: "text-red-400 font-semibold",
  today: "text-orange-400 font-semibold",
  soon: "text-yellow-400",
  normal: "text-muted-foreground/60",
} as const;

interface TaskCardProps {
  task: KanbanTask;
  onEdit?: (task: KanbanTask) => void;
  onStartFocus?: (task: KanbanTask) => void;
  onDuplicate?: (task: KanbanTask) => void;
  showCreatedDate?: boolean;
  /** Set to false to disable drag-and-drop (e.g. inside a modal/drawer) */
  draggable?: boolean;
}

/** Auto-clears after 1.5s */
function useBlockedMsg(): [boolean, (v: boolean) => void] {
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trigger = (v: boolean) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(v);
    if (v) {
      timerRef.current = setTimeout(() => {
        setShow(false);
        timerRef.current = null;
      }, 1500);
    }
  };
  return [show, trigger];
}

export function TaskCard({
  task,
  onEdit,
  onStartFocus,
  onDuplicate,
  showCreatedDate,
  draggable = true,
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

  const { play } = useSoundEffects();

  const tKanban = useTranslations("kanban");
  const tTask = useTranslations("taskForm");

  // ── Blocked-operation feedback ──────────────────────────────────────
  const [showBlockedMsg, setShowBlockedMsg] = useBlockedMsg();

  const {
    activeTask,
    status: focusStatus,
    focusType,
    currentSession,
    totalSessions,
    shortFocusDuration,
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
      label: tTask("priorityLow"),
    },
    [TaskPriority.MEDIUM]: {
      bg: "bg-yellow-500/20",
      text: "text-yellow-400",
      label: tTask("priorityMedium"),
    },
    [TaskPriority.HIGH]: {
      bg: "bg-orange-500/20",
      text: "text-orange-400",
      label: tTask("priorityHigh"),
    },
    [TaskPriority.URGENT]: {
      bg: "bg-red-500/20",
      text: "text-red-400",
      label: tTask("priorityUrgent"),
    },
  };

  // ── Session type color bar helpers ──────────────────────────────────
  const allFocusSessions = task.focusSessions ?? [];
  const quick5 = allFocusSessions.filter(
    (s) => getSessionType(s.plannedDuration) === "QUICK_5",
  );
  const quick15 = allFocusSessions.filter(
    (s) => getSessionType(s.plannedDuration) === "QUICK_15",
  );
  const standardDone = allFocusSessions.filter(
    (s) =>
      getSessionType(s.plannedDuration) === "STANDARD" &&
      s.status === "COMPLETED",
  );

  const standardPlan = task.focusTotalSessions || 0;
  const standardRemaining = Math.max(0, standardPlan - standardDone.length);

  const liveType: SessionColorKey | null = isFocusing
    ? focusType === "STANDARD"
      ? "STANDARD"
      : shortFocusDuration <= 300
        ? "QUICK_5"
        : "QUICK_15"
    : null;

  type Seg = {
    colorKey: SessionColorKey;
    state: "done" | "live" | "empty";
    minutes: number;
  };
  const segments: Seg[] = [
    ...quick5.map(
      (): Seg => ({ colorKey: "QUICK_5", state: "done", minutes: 5 }),
    ),
    ...(liveType === "QUICK_5"
      ? [{ colorKey: "QUICK_5" as const, state: "live" as const, minutes: 5 }]
      : []),
    ...quick15.map(
      (): Seg => ({ colorKey: "QUICK_15", state: "done", minutes: 15 }),
    ),
    ...(liveType === "QUICK_15"
      ? [{ colorKey: "QUICK_15" as const, state: "live" as const, minutes: 15 }]
      : []),
    ...standardDone.map(
      (): Seg => ({ colorKey: "STANDARD", state: "done", minutes: 25 }),
    ),
    ...Array.from(
      { length: standardRemaining },
      (_, i): Seg => ({
        colorKey: "STANDARD",
        state: liveType === "STANDARD" && i === 0 ? "live" : "empty",
        minutes: 25,
      }),
    ),
    ...(liveType === "STANDARD" && standardRemaining === 0
      ? [{ colorKey: "STANDARD" as const, state: "live" as const, minutes: 25 }]
      : []),
  ];
  const totalMinutes = segments.reduce((s, seg) => s + seg.minutes, 0) || 1;
  const shouldShowProgress = segments.length > 0;

  const liveFocusingStandard = isFocusing && focusType === "STANDARD";
  const standardTotal = liveFocusingStandard ? totalSessions : standardPlan;
  // Always derive from the focusSessions array (never from store counters which include quick sessions)
  const standardCompletedCount = standardDone.length;
  const showStandardProgress = standardTotal > 0;
  const standardPct = showStandardProgress
    ? Math.round((standardCompletedCount / standardTotal) * 100)
    : 0;

  const typesInBar = new Set(
    segments.filter((s) => s.state !== "empty").map((s) => s.colorKey),
  );

  const handleStartFocus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStartFocus) {
      onStartFocus(task);
    }
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFocusing) { setShowBlockedMsg(true); return; }
    if (onDuplicate) {
      onDuplicate(task);
    }
  };

  const handleClick = () => {
    if (isFocusing) { setShowBlockedMsg(true); return; }
    if (onEdit && !isDragging) {
      play("task-click-drag");
      onEdit(task);
    }
  };

  const isToday = task.status === TaskStatus.TODAY;
  const isDone = task.status === TaskStatus.DONE;
  const dueDateUrgency = getDueDateUrgency(task.dueDate);
  /** In TODAY column: overdue dueDate → blinking alert */
  const showOverdueAlert = isToday && dueDateUrgency === "overdue";

  return (
    <motion.div
      ref={draggable ? setNodeRef : undefined}
      style={draggable ? style : undefined}
      {...(draggable && !isFocusing ? attributes : {})}
      {...(draggable && !isFocusing ? listeners : {})}
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
          ${isFocusing ? "cursor-not-allowed" : draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
          transition-all duration-200
          group
          relative overflow-hidden
        `}
        onClick={handleClick}
      >
        {/* ── Focus-locked overlay ── */}
        <AnimatePresence>
          {showBlockedMsg && (
            <motion.div
              key="blocked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/70 backdrop-blur-sm z-20 gap-1 px-3 pointer-events-none"
            >
              <span className="text-base">🎯</span>
              <span className="text-xs font-semibold text-white text-center leading-snug">
                {tKanban("focusInProgress")}
              </span>
              <span className="text-[10px] text-white/60 text-center">
                {tKanban("cannotOperateTask")}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-bold line-clamp-2 flex-1 min-w-0">
              {task.title}
            </h4>
            <div className="flex items-center gap-1 shrink-0">
              {!isFocusing && onDuplicate && task.status !== TaskStatus.TODAY && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-cyan-500/20"
                  onClick={handleDuplicate}
                  title={tKanban("duplicateTask")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              )}
              {isToday && !isFocusing && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20"
                  onClick={handleStartFocus}
                  title={tKanban("startFocus")}
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
                    ? tKanban("session", { current: currentSession, total: totalSessions })
                    : focusStatus === "focusing"
                      ? tKanban("focusing")
                      : focusStatus === "break"
                        ? tKanban("break")
                        : tKanban("paused")}
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
            <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
              {task.description}
            </p>
          )}

          {shouldShowProgress && (
            <div className="space-y-1">
              {/* Progress label */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  {showStandardProgress && (
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: SESSION_COLORS.STANDARD }}
                    />
                  )}
                  {liveFocusingStandard
                    ? `Tiến độ ${standardDone.length + 1} / ${totalSessions}`
                    : showStandardProgress
                      ? `${standardCompletedCount} / ${standardTotal}`
                      : isFocusing
                        ? tKanban("focusing")
                        : `✅ ${allFocusSessions.length} phiên hoàn thành`}
                </span>
                {showStandardProgress && <span>{standardPct}%</span>}
              </div>

              {/* Multi-color proportional progress bar */}
              <div
                className="h-1.5 rounded-full overflow-hidden flex gap-0.5"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                {segments.map((seg, i) => {
                  const w = `${(seg.minutes / totalMinutes) * 100}%`;
                  if (seg.state === "live") {
                    return (
                      <motion.div
                        key={i}
                        className="h-full"
                        style={{
                          width: w,
                          backgroundColor: SESSION_COLORS[seg.colorKey],
                        }}
                        animate={{ opacity: [0.35, 0.75, 0.35] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    );
                  }
                  if (seg.state === "empty") {
                    return (
                      <div
                        key={i}
                        className="h-full bg-white/10"
                        style={{ width: w }}
                      />
                    );
                  }
                  return (
                    <div
                      key={i}
                      className="h-full"
                      title={SESSION_LABELS[seg.colorKey]}
                      style={{
                        width: w,
                        backgroundColor: SESSION_COLORS[seg.colorKey],
                      }}
                    />
                  );
                })}
              </div>

              {/* Legend — only when multiple types present */}
              {typesInBar.size >= 1 && (
                <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground/50">
                  {(["QUICK_5", "QUICK_15", "STANDARD"] as SessionColorKey[])
                    .filter((t) => typesInBar.has(t))
                    .map((t) => (
                      <span key={t} className="flex items-center gap-0.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full inline-block"
                          style={{ backgroundColor: SESSION_COLORS[t] }}
                        />
                        {SESSION_LABELS[t]}
                      </span>
                    ))}
                </div>
              )}
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
              {task.suggestedSessionType === "QUICK_15" && (
                <div
                  className="flex items-center gap-1 text-purple-400/80"
                  title="AI gợi ý: Quick 15 phút"
                >
                  <Zap className="h-3 w-3" />
                  <span>⚡ Quick 15p</span>
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

              {task.dueDate && !isDone && (
                <div
                  className={`flex items-center gap-1 ${dueDateUrgency ? URGENCY_STYLES[dueDateUrgency] : ""}`}
                >
                  <CalendarDays className="h-3 w-3" />
                  <span>
                    {dueDateUrgency === "overdue"
                      ? "Quá hạn"
                      : dueDateUrgency === "today"
                        ? tKanban("today")
                        : new Date(task.dueDate).toLocaleDateString("vi-VN")}
                  </span>
                </div>
              )}

              {showOverdueAlert && (
                <motion.div
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="flex items-center gap-1 text-red-400"
                  title="Nhiệm vụ này đã quá hạn!"
                >
                  <AlertTriangle className="h-3 w-3" />
                </motion.div>
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
