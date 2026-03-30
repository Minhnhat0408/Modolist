"use client";

import { useFocusWorld, FocusUser } from "@/hooks/useFocusWorld";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

interface FocusWorldPanelProps {
  userId: string | null;
  sessionId: string | null;
  taskId?: string | null;
  enabled?: boolean;
  userName?: string | null;
  userImage?: string | null;
}

function ProgressRing({
  startTime,
  duration,
  size = 80,
}: {
  startTime: string;
  duration: number;
  size?: number;
}) {
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState("");

  useEffect(() => {
    const updateProgress = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const elapsed = (now - start) / 1000; // seconds
      const percentage = Math.min((elapsed / duration) * 100, 100);

      setProgress(percentage);

      // Calculate time remaining
      const remaining = Math.max(duration - elapsed, 0);
      const minutes = Math.floor(remaining / 60);
      const seconds = Math.floor(remaining % 60);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);

    return () => clearInterval(interval);
  }, [startTime, duration]);

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
          strokeWidth="4"
          fill="transparent"
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="text-primary transition-all duration-1000"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-xs font-medium">{timeRemaining}</div>
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
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <Avatar className="h-12 w-12 border-2 border-primary/20">
        <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {user.name || "Anonymous"}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {user.currentTask}
        </p>
      </div>

      <ProgressRing
        startTime={user.focusProps.startTime}
        duration={user.focusProps.duration}
        size={64}
      />
    </div>
  );
}

export function FocusWorldPanel({
  userId,
  sessionId,
  taskId,
  enabled = true,
  userName,
  userImage,
}: FocusWorldPanelProps) {
  const { isConnected, focusUsers } = useFocusWorld({
    userId,
    sessionId,
    taskId,
    enabled,
    userName,
    userImage,
  });

  // Filter out current user from the list
  const otherUsers = focusUsers.filter((u) => u.userId !== userId);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Co-Focus World</CardTitle>
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
            <Badge variant="outline">{otherUsers.length}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {!enabled && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Start a focus session to see others</p>
          </div>
        )}

        {enabled && !isConnected && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Connecting...</p>
          </div>
        )}

        {enabled && isConnected && otherUsers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No one else is focusing right now</p>
            <p className="text-xs mt-1">Be the pioneer! 🚀</p>
          </div>
        )}

        {enabled && isConnected && otherUsers.length > 0 && (
          <div className="space-y-2 max-h-125 overflow-y-auto">
            {otherUsers.map((user) => (
              <FocusUserCard key={user.userId} user={user} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
