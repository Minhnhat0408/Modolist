"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Target, Plus, Minus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanTask } from "@/types/kanban";
import { useFocusStore } from "@/stores/useFocusStore";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalBody,
} from "@/components/ui/responsive-modal";

interface FocusStartDialogProps {
  task: KanbanTask;
  open: boolean;
  onClose: () => void;
}

export function FocusStartDialog({
  task,
  open,
  onClose,
}: FocusStartDialogProps) {
  // Detect if task has existing session data
  const standardCompletedCount = (task.focusSessions ?? []).filter(
    (s) => s.plannedDuration > 900,
  ).length;
  const hasExistingSession =
    task.focusTotalSessions && task.focusTotalSessions > 0;
  const isSessionInProgress =
    hasExistingSession && standardCompletedCount < task.focusTotalSessions!;
  const remainingSessions = hasExistingSession
    ? Math.max(0, task.focusTotalSessions! - standardCompletedCount)
    : 4;

  // If the task has an AI estimate and no existing session, pre-fill with it
  const defaultSessions =
    !hasExistingSession &&
    task.estimatedPomodoros &&
    task.estimatedPomodoros > 0
      ? Math.min(task.estimatedPomodoros, 10)
      : remainingSessions;

  // Determine AI recommendation
  const aiRecommendation = task.suggestedSessionType as
    | "QUICK_5"
    | "QUICK_15"
    | "STANDARD"
    | null
    | undefined;

  const [sessionCount, setSessionCount] = useState(defaultSessions);
  const { startShortFocus, startStandardFocus } = useFocusStore();

  const handleQuickFocus = (minutes: 5 | 15) => {
    startShortFocus(task, minutes);
    onClose();
  };

  const handleStandardFocus = () => {
    if (sessionCount < 1) {
      alert("Số session phải lớn hơn 0");
      return;
    }
    startStandardFocus(task, sessionCount);
    onClose();
  };

  const handleResumeFocus = () => {
    // Resume with remaining sessions
    startStandardFocus(task, remainingSessions);
    onClose();
  };

  const incrementSessions = () => {
    if (sessionCount < 10) setSessionCount(sessionCount + 1);
  };

  const decrementSessions = () => {
    if (sessionCount > 1) setSessionCount(sessionCount - 1);
  };

  const totalMinutes = sessionCount * 25 + (sessionCount - 1) * 5;

  if (!open) return null;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <ResponsiveModalContent
        dialogClassName="sm:max-w-md bg-linear-to-br from-gray-900 to-gray-800 border-gray-700 p-0 gap-0"
        className="bg-linear-to-br from-gray-900 to-gray-800 border-gray-700 p-0 gap-0"
      >
        <ResponsiveModalHeader className="px-6 pt-6 pb-4">
          <ResponsiveModalTitle className="text-2xl font-bold text-white">
            Bắt đầu Focus
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-sm text-gray-400 line-clamp-2">
            {task.title}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <ResponsiveModalBody className="px-6 pb-8">
          {/* AI Recommendation Banner */}
          {!isSessionInProgress &&
            aiRecommendation &&
            (aiRecommendation === "QUICK_5" ||
              aiRecommendation === "QUICK_15") && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  ✨ AI gợi ý{" "}
                  <strong>
                    {aiRecommendation === "QUICK_5"
                      ? "Quick 5 phút"
                      : "Quick 15 phút"}
                  </strong>{" "}
                  cho task này
                  {task.suggestedTotalMinutes
                    ? ` (~${task.suggestedTotalMinutes} phút)`
                    : ""}
                </span>
              </motion.div>
            )}

          {/* Type A: Quick Focus - Hide when session in progress */}
          {!isSessionInProgress && (
            <>
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-lg font-semibold text-white">
                    Focus Nhanh
                  </h3>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Một phiên làm việc, không nghỉ giải lao. Phù hợp cho công việc
                  ngắn.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleQuickFocus(5)}
                    className={`h-16 text-white font-semibold shadow-lg ${
                      aiRecommendation === "QUICK_5"
                        ? "bg-linear-to-br from-blue-500 to-blue-600 ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900"
                        : "bg-linear-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600"
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-bold">5</span>
                      <span className="text-xs opacity-80">Minutes</span>
                      {aiRecommendation === "QUICK_5" && (
                        <span className="text-[10px] text-yellow-300 mt-0.5">
                          ✨ AI gợi ý
                        </span>
                      )}
                    </div>
                  </Button>
                  <Button
                    onClick={() => handleQuickFocus(15)}
                    className={`h-16 text-white font-semibold shadow-lg ${
                      aiRecommendation === "QUICK_15"
                        ? "bg-linear-to-br from-purple-500 to-purple-600 ring-2 ring-purple-400 ring-offset-2 ring-offset-gray-900"
                        : "bg-linear-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600"
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-bold">15</span>
                      <span className="text-xs opacity-80">Minutes</span>
                      {aiRecommendation === "QUICK_15" && (
                        <span className="text-[10px] text-yellow-300 mt-0.5">
                          ✨ AI gợi ý
                        </span>
                      )}
                    </div>
                  </Button>
                </div>
              </div>

              {/* Divider */}
              <div className="relative mb-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-gray-800 px-3 text-sm text-gray-400">
                    hoặc
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Type B: Standard Focus (Pomodoro) */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-semibold text-white">
                Focus Chuẩn (Pomodoro)
              </h3>
            </div>

            {/* Resume Mode - When session is in progress */}
            {isSessionInProgress ? (
              <>
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-linear-to-br from-blue-600/30 to-blue-800/30 border-2 border-blue-500/50 rounded-xl p-6 mb-4"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Target className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold text-lg">
                        Đang Có Phiên Focus
                      </h4>
                      <p className="text-blue-300 text-sm">
                        Tiếp tục từ nơi bạn đã dừng lại
                      </p>
                    </div>
                  </div>

                  {/* Progress Stats */}
                  <div className="bg-gray-900/50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">
                        Đã hoàn thành
                      </span>
                      <span className="text-white font-bold">
                        {standardCompletedCount} / {task.focusTotalSessions}{" "}
                        phiên
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Còn lại</span>
                      <span className="text-green-400 font-bold">
                        {remainingSessions} phiên
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">
                        Thời gian dự kiến
                      </span>
                      <span className="text-white font-semibold">
                        ~{remainingSessions * 25 + (remainingSessions - 1) * 5}{" "}
                        phút
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="pt-2">
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${(standardCompletedCount / task.focusTotalSessions!) * 100}%`,
                          }}
                          transition={{ duration: 0.5 }}
                          className="h-full bg-linear-to-r from-blue-500 to-blue-400 rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>

                <Button
                  onClick={handleResumeFocus}
                  className="w-full h-14 bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold shadow-lg text-lg"
                >
                  Tiếp Tục Focus
                </Button>
              </>
            ) : (
              <>
                {/* New Session Mode */}
                <p className="text-sm text-gray-400 mb-4">
                  Kỹ thuật Pomodoro với chu kỳ làm việc/nghỉ giải lao cho deep
                  work.
                </p>

                {/* AI Estimate hint */}
                {aiRecommendation === "STANDARD" &&
                task.estimatedPomodoros &&
                task.estimatedPomodoros > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      ✨ AI gợi ý{" "}
                      <strong>
                        Focus Chuẩn — {task.estimatedPomodoros} phiên
                      </strong>
                      {task.suggestedTotalMinutes
                        ? ` (~${task.suggestedTotalMinutes} phút)`
                        : ""}
                    </span>
                  </motion.div>
                ) : task.estimatedPomodoros && task.estimatedPomodoros > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      AI ước tính <strong>{task.estimatedPomodoros} 🍅</strong>{" "}
                      cho task này
                    </span>
                  </motion.div>
                ) : null}

                <div className="bg-gray-800/50 rounded-xl p-6 mb-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-gray-300 font-medium">
                      Số phiên làm việc
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={decrementSessions}
                        disabled={sessionCount <= 1}
                        className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-white"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                      <motion.div
                        key={sessionCount}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        className="w-16 h-16 rounded-xl bg-linear-to-br from-green-600 to-green-700 flex items-center justify-center"
                      >
                        <span className="text-3xl font-bold text-white">
                          {sessionCount}
                        </span>
                      </motion.div>
                      <button
                        onClick={incrementSessions}
                        disabled={sessionCount >= 10}
                        className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-white"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Tổng thời gian</span>
                    <span className="text-white font-semibold">
                      ~{totalMinutes} phút
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    ({sessionCount} × 25 phút làm việc + {sessionCount - 1} × 5
                    phút nghỉ)
                  </div>
                </div>

                <Button
                  onClick={handleStandardFocus}
                  className="w-full h-12 bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold shadow-lg"
                >
                  Bắt đầu {sessionCount} phiên
                </Button>
              </>
            )}
          </div>
        </ResponsiveModalBody>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
