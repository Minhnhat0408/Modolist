"use client";

import { FocusWorldPanel } from "./FocusWorldPanel";
import { useFocusStore } from "@/stores/useFocusStore";
import { useSession } from "@/hooks/useSupabaseSession";

export function FocusWorldContainer() {
  const { data: session } = useSession();
  const { sessionId, activeTask, status } = useFocusStore();

  const userId = session?.user?.id || null;
  const taskId = activeTask?.id || null;

  // Only enable when user is actively focusing
  const enabled = status === "focusing" && !!sessionId;

  return (
    <FocusWorldPanel
      userId={userId}
      sessionId={sessionId}
      taskId={taskId}
      enabled={enabled}
      userName={session?.user?.name ?? null}
      userImage={session?.user?.image ?? null}
    />
  );
}
