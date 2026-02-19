'use client';

import { motion } from 'framer-motion';
import { useFocusWorldStore } from '@/stores/useFocusWorldStore';
import { useFocusStore } from '@/stores/useFocusStore';
import { useFocusWorld } from '@/hooks/useFocusWorld';
import { useSession } from 'next-auth/react';
import { Users, Wifi, WifiOff, Maximize2, X } from 'lucide-react';
import Image from 'next/image';

export function FloatingWorldButton() {
  const { data: session } = useSession();
  const { isMinimized, toggleMinimize, closeWorld } = useFocusWorldStore();
  const { sessionId, activeTask, status, timeLeft } = useFocusStore();

  const userId = session?.user?.id || null;
  const taskId = activeTask?.id || null;

  // Only enable when user is focusing/paused and has opened the world
  const canConnect = (status === 'focusing' || status === 'paused') && !!sessionId && !!userId;
  const enabled = canConnect && isMinimized;

  const { isConnected, focusUsers } = useFocusWorld({
    userId,
    sessionId,
    taskId,
    timeLeft, // Pass current timeLeft for accurate timer
    focusStatus: status,
    enabled,
  });

  // Filter out current user
  const otherUsers = focusUsers.filter((u) => u.userId !== userId);

  if (!isMinimized) return null;

  return (
    <motion.div
      layoutId="focus-world"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-6 left-6 z-50"
      drag
      dragConstraints={{
        top: -window.innerHeight + 200,
        left: 0,
        right: window.innerWidth - 400,
        bottom: 0,
      }}
      dragElastic={0.1}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="bg-linear-to-br from-primary/90 to-primary rounded-2xl shadow-2xl border border-primary-foreground/20 overflow-hidden backdrop-blur-lg">
        {/* Content */}
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Icon with pulse */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full bg-primary-foreground/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary-foreground" />
            </div>
            {isConnected && (
              <div className="absolute -top-1 -right-1">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 text-primary-foreground">
            <div className="text-xs opacity-80 mb-0.5 flex items-center gap-1.5">
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3" />
                  <span>Focus World</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  <span>Offline</span>
                </>
              )}
            </div>
            <div className="text-sm font-semibold">
              {otherUsers.length === 0
                ? 'Chưa có ai'
                : `${otherUsers.length} người đang focus`}
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            {/* Maximize */}
            <button
              onClick={toggleMinimize}
              className="w-8 h-8 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors flex items-center justify-center text-primary-foreground"
              aria-label="Phóng to"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={closeWorld}
              className="w-8 h-8 rounded-full bg-primary-foreground/10 hover:bg-red-500/50 transition-colors flex items-center justify-center text-primary-foreground hover:text-white"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mini user avatars */}
        {isConnected && otherUsers.length > 0 && (
          <div className="px-4 pb-3 flex -space-x-2">
            {otherUsers.slice(0, 5).map((user) => (
              <div
                key={user.userId}
                className={`w-8 h-8 rounded-full border-2 border-primary bg-background overflow-hidden relative ${
                  user.isPaused ? 'opacity-40 grayscale' : ''
                }`}
                title={`${user.name || 'User'}${user.isPaused ? ' (Paused)' : ''}`}
              >
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name || 'User'}
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-xs font-medium">
                    {user.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
            ))}
            {otherUsers.length > 5 && (
              <div className="w-8 h-8 rounded-full border-2 border-primary bg-primary-foreground/20 flex items-center justify-center text-xs font-medium text-primary-foreground">
                +{otherUsers.length - 5}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
