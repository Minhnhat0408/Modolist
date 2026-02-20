"use client";

import { FocusTimerModal } from "./FocusTimerModal";
import { FloatingTimer } from "./FloatingTimer";
import { CompletionModal } from "./CompletionModal";
import { FocusWorld } from "./FocusWorld";
import { useSessionLifecycle } from "@/hooks/useSessionLifecycle";

export function FocusTimer() {
  useSessionLifecycle();
  return (
    <>
      <FocusTimerModal />
      <FloatingTimer />
      <CompletionModal />
      <FocusWorld />
    </>
  );
}
