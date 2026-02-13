"use client";

import { FocusTimerModal } from "./FocusTimerModal";
import { FloatingTimer } from "./FloatingTimer";
import { CompletionModal } from "./CompletionModal";

/**
 * FocusTimer wrapper component that renders modal, floating widget, and completion modal
 * This should be placed at the root of your app (e.g., in the dashboard layout)
 */
export function FocusTimer() {
  return (
    <>
      <FocusTimerModal />
      <FloatingTimer />
      <CompletionModal />
    </>
  );
}
