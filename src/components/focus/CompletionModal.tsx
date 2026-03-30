"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useFocusStore } from "@/stores/useFocusStore";
import { PartyPopper, Plus, CheckCircle, Coffee, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CompletionModal() {
  const {
    showCompletionModal,
    focusType,
    totalSessions,
    status,
    addOneSession,
    addQuickSession,
    completeAndExit,
    takeLongBreak,
  } = useFocusStore();

  if (!showCompletionModal) return null;

  const isAllCompleted = status === "all_completed";
  const isShortFocus = focusType === "SHORT";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          className="bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl border border-gray-700"
        >
          {/* Celebration Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-block mb-4"
            >
              <div className="w-20 h-20 rounded-full bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <PartyPopper className="w-10 h-10 text-white" />
              </div>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold text-white mb-2"
            >
              {isShortFocus
                ? "🎉 Hoàn Thành Focus!"
                : `🎉 Hoàn Thành ${totalSessions} Phiên!`}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-gray-300"
            >
              {isShortFocus
                ? "Làm tốt lắm! Bạn vừa hoàn thành phiên focus nhanh!"
                : `Tuyệt vời! Bạn đã hoàn thành ${totalSessions} phiên focus. Bạn muốn làm gì tiếp theo?`}
            </motion.p>
          </div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-3"
          >
            {/* Quick Focus: add more quick sessions */}
            {isShortFocus && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => addQuickSession(5)}
                  className="h-14 bg-linear-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold shadow-lg"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  +5 phút nữa
                </Button>
                <Button
                  onClick={() => addQuickSession(15)}
                  className="h-14 bg-linear-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-semibold shadow-lg"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  +15 phút nữa
                </Button>
              </div>
            )}

            {/* Primary: Add +1 Session (only for STANDARD type) */}
            {!isShortFocus && isAllCompleted && (
              <Button
                onClick={addOneSession}
                className="w-full h-14 bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold shadow-lg group relative overflow-hidden"
              >
                <motion.div
                  className="absolute inset-0 bg-white/20"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.3, 0.1, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <Plus className="w-5 h-5 mr-2 relative z-10" />
                <span className="relative z-10">
                  Thêm +1 Phiên (Tiếp tục nhịp!)
                </span>
              </Button>
            )}

            {/* Take a Long Break (only for STANDARD type) */}
            {!isShortFocus && isAllCompleted && (
              <Button
                onClick={takeLongBreak}
                className="w-full h-14 bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold shadow-lg"
              >
                <Coffee className="w-5 h-5 mr-2" />
                Nghỉ Dài (15 phút)
              </Button>
            )}

            {/* Complete & Exit */}
            <Button
              onClick={completeAndExit}
              variant={isShortFocus ? "default" : "outline"}
              className={`w-full h-14 font-semibold ${
                isShortFocus
                  ? "bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg"
                  : "border-gray-600 hover:bg-gray-800 text-white"
              }`}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Hoàn Thành & Thoát
            </Button>
          </motion.div>

          {/* Stats (optional) */}
          {!isShortFocus && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-6 pt-6 border-t border-gray-700"
            >
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-white">
                    {totalSessions * 25}
                  </p>
                  <p className="text-xs text-gray-400">Phút tập trung</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {totalSessions}
                  </p>
                  <p className="text-xs text-gray-400">Phiên đã hoàn thành</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Encouragement message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-4 text-center"
          >
            <p className="text-xs text-gray-500 italic">
              &ldquo;The secret of getting ahead is getting started.&rdquo; -
              Mark Twain
            </p>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
