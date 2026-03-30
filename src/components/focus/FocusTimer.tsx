"use client";

import { FocusTimerModal } from "./FocusTimerModal";
import { FloatingWidget } from "./FloatingWidget";
import { CompletionModal } from "./CompletionModal";
import { useSessionLifecycle } from "@/hooks/useSessionLifecycle";
import { FocusWorldModal } from "./FocusWorldModal";

export function FocusTimer() {
  useSessionLifecycle();
  return (
    <>
      <FocusTimerModal />
      <FloatingWidget />
      <CompletionModal />
      <FocusWorldModal />
    </>
  );
}
