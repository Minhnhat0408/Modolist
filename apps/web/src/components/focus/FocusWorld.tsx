'use client';

import { FocusWorldModal } from './FocusWorldModal';
import { FloatingWorldButton } from './FloatingWorldButton';

/**
 * FocusWorld wrapper component that renders modal and floating button
 */
export function FocusWorld() {
  return (
    <>
      <FocusWorldModal />
      <FloatingWorldButton />
    </>
  );
}
