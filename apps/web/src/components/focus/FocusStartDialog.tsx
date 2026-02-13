"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Target, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanTask } from "@/types/kanban";
import { useFocusStore } from "@/stores/useFocusStore";

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
  const hasExistingSession =
    task.focusTotalSessions && task.focusTotalSessions > 0;
  const isSessionInProgress =
    hasExistingSession &&
    (task.focusCompletedSessions || 0) < task.focusTotalSessions!;
  const remainingSessions = hasExistingSession
    ? Math.max(0, task.focusTotalSessions! - (task.focusCompletedSessions || 0))
    : 4;

  const [sessionCount, setSessionCount] = useState(remainingSessions);
  const { startShortFocus, startStandardFocus } = useFocusStore();

  const handleQuickFocus = (minutes: 5 | 25) => {
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
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-linear-to-br from-gray-900 to-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-2">
                Bắt đầu Focus
              </h2>
              <p className="text-sm text-gray-400 line-clamp-2">{task.title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

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
                    className="h-16 bg-linear-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold shadow-lg"
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-bold">5</span>
                      <span className="text-xs opacity-80">Minutes</span>
                    </div>
                  </Button>
                  <Button
                    onClick={() => handleQuickFocus(25)}
                    className="h-16 bg-linear-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-semibold shadow-lg"
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-bold">25</span>
                      <span className="text-xs opacity-80">Minutes</span>
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
                        {task.focusCompletedSessions} /{" "}
                        {task.focusTotalSessions} phiên
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
                            width: `${(task.focusCompletedSessions! / task.focusTotalSessions!) * 100}%`,
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

                {/* Session Counter */}
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
