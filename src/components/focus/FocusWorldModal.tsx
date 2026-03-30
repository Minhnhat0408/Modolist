"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useFocusWorldStore } from "@/stores/useFocusWorldStore";
import { useFocusStore } from "@/stores/useFocusStore";
import { useFocusWorld, FocusUser } from "@/hooks/useFocusWorld";
import { useSession } from "@/hooks/useSupabaseSession";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Wifi, WifiOff, Minimize2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { openPip, resizePIP, calcPIPHeight } from "@/hooks/usePictureInPicture";
import { useSpotifyStore } from "@/stores/useSpotifyStore";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalBody,
} from "@/components/ui/responsive-modal";

function ProgressRing({
  startTime,
  duration,
  size = 100,
  isPaused = false,
}: {
  startTime: string;
  duration: number;
  size?: number;
  isPaused?: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState("");

  useEffect(() => {
    const updateProgress = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const elapsed = (now - start) / 1000;
      const percentage = Math.min((elapsed / duration) * 100, 100);

      setProgress(percentage);

      const remaining = Math.max(duration - elapsed, 0);
      const minutes = Math.floor(remaining / 60);
      const seconds = Math.floor(remaining % 60);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    updateProgress();
    if (!isPaused) {
      const interval = setInterval(updateProgress, 1000);
      return () => clearInterval(interval);
    }
  }, [startTime, duration, isPaused]);

  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={`transition-all duration-1000 ${isPaused ? "text-muted-foreground" : "text-primary"}`}
          strokeLinecap="round"
        />
      </svg>
      <div
        className={`absolute text-sm font-mono font-bold ${isPaused ? "text-muted-foreground" : ""}`}
      >
        {isPaused ? "Paused" : timeRemaining}
      </div>
    </div>
  );
}

function FocusUserCard({ user }: { user: FocusUser }) {
  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`flex items-center gap-4 p-4 rounded-xl border bg-card transition-colors ${
        user.isPaused ? "opacity-50 grayscale" : "hover:bg-accent/50"
      }`}
    >
      <Avatar
        className={`h-16 w-16 border-2 ${
          user.isPaused ? "border-muted-foreground/30" : "border-primary/20"
        }`}
      >
        <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
        <AvatarFallback className="text-lg">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-base truncate">
          {user.name || "Anonymous"}
        </p>
        <p className="text-sm text-muted-foreground truncate">
          {user.isPaused ? "⏸ Đang tạm dừng" : user.currentTask}
        </p>
      </div>

      <ProgressRing
        startTime={user.focusProps.startTime}
        duration={user.focusProps.duration}
        size={80}
        isPaused={user.isPaused}
      />
    </motion.div>
  );
}

export function FocusWorldModal() {
  const { data: session } = useSession();
  const { isOpen, isMinimized, toggleMinimize, closeWorld } =
    useFocusWorldStore();
  const { sessionId, activeTask, status, timeLeft } = useFocusStore();
  const spotifyWidgetMinimized = useSpotifyStore((s) => s.isWidgetMinimized);
  const [isInitializing, setIsInitializing] = useState(true);

  const handleMinimize = async () => {
    await openPip(120, 460);
    // Check which tabs are already in PiP before this action
    const timerInPip = !!activeTask;
    const spotifyInPip = spotifyWidgetMinimized;
    // If other tabs exist → tab bar will appear → resize
    if (timerInPip || spotifyInPip) {
      resizePIP(
        calcPIPHeight({
          timer: timerInPip,
          world: true,
          spotify: spotifyInPip,
          target: "world",
        }),
      );
    }
    toggleMinimize();
  };

  const userId = session?.user?.id || null;
  const taskId = activeTask?.id || null;

  const canConnect =
    (status === "focusing" || status === "paused") && !!sessionId && !!userId;
  const enabled = canConnect && isOpen && !isMinimized;

  const { isConnected, focusUsers } = useFocusWorld({
    userId,
    sessionId,
    taskId,
    timeLeft, // Pass current timeLeft for accurate timer
    focusStatus: status,
    enabled,
    userName: session?.user?.name ?? null,
    userImage: session?.user?.image ?? null,
  });

  // Stop showing initializing state after connection established
  useEffect(() => {
    if (isConnected) {
      const timer = setTimeout(() => setIsInitializing(false), 500);
      return () => clearTimeout(timer);
    } else if (enabled) {
      setIsInitializing(true);
    }
  }, [isConnected, enabled]);

  // Filter out current user
  const otherUsers = focusUsers.filter((u) => u.userId !== userId);

  if (!isOpen || isMinimized) return null;

  const modalOpen = isOpen && !isMinimized;

  return (
    <ResponsiveModal
      open={modalOpen}
      onOpenChange={(v) => {
        if (!v) handleMinimize();
      }}
    >
      <ResponsiveModalContent
        dialogClassName="sm:max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl"
        className="p-0 gap-0"
        showCloseButton={false}
      >
        {/* Header */}
        <ResponsiveModalHeader className="flex-row items-center justify-between px-6 py-4 border-b gap-0">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <ResponsiveModalTitle className="text-2xl font-bold">
                Co-Focus World
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-sm">
                Những người đang tập trung cùng bạn
              </ResponsiveModalDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={isConnected ? "default" : "secondary"}
              className="gap-1"
            >
              {isConnected ? (
                <>
                  <Wifi className="h-3 w-3" />
                  Live
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  Offline
                </>
              )}
            </Badge>
            <Badge variant="outline">{otherUsers.length} người</Badge>

            <button
              onClick={handleMinimize}
              className="w-9 h-9 rounded-lg hover:bg-accent transition-colors flex items-center justify-center"
              aria-label="Thu nhỏ"
            >
              <Minimize2 className="h-4 w-4" />
            </button>

            <button
              onClick={closeWorld}
              className="w-9 h-9 rounded-lg hover:bg-accent transition-colors flex items-center justify-center"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </ResponsiveModalHeader>

        {/* Content */}
        <ResponsiveModalBody>
          {!enabled && (
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">Bắt đầu Focus Session</p>
              <p className="text-sm text-muted-foreground">
                Bạn cần có focus session đang chạy để vào Focus World
              </p>
            </div>
          )}

          {enabled && isInitializing && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Đang kết nối...</p>
            </div>
          )}

          {enabled && !isInitializing && otherUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">Chưa có ai ở đây</p>
              <p className="text-sm text-muted-foreground">
                Hãy là người tiên phong! Các bạn khác sẽ sớm tham gia 🚀
              </p>
            </div>
          )}

          {enabled && !isInitializing && otherUsers.length > 0 && (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {otherUsers.map((user) => (
                  <FocusUserCard key={user.userId} user={user} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </ResponsiveModalBody>

        {/* Footer */}
        {enabled && !isInitializing && (
          <div className="px-6 py-4 border-t bg-muted/50 shrink-0">
            <p className="text-xs text-center text-muted-foreground">
              💡 Tip: Thu nhỏ để xem trong khi làm việc
            </p>
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
