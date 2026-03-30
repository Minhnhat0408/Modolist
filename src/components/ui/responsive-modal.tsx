"use client";

/**
 * ResponsiveModal — Desktop: centered Dialog. Mobile: bottom Sheet.
 *
 * Drop-in replacement for Dialog that automatically switches to a bottom
 * Sheet on viewports narrower than 768 px.
 *
 * Usage:
 *   <ResponsiveModal open={open} onOpenChange={setOpen}>
 *     <ResponsiveModalContent>
 *       <ResponsiveModalHeader>
 *         <ResponsiveModalTitle>…</ResponsiveModalTitle>
 *         <ResponsiveModalDescription>…</ResponsiveModalDescription>
 *       </ResponsiveModalHeader>
 *       <ResponsiveModalBody>…</ResponsiveModalBody>
 *       <ResponsiveModalFooter>…</ResponsiveModalFooter>
 *     </ResponsiveModalContent>
 *   </ResponsiveModal>
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

// ─── Root ────────────────────────────────────────────────────────────
interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function ResponsiveModal({
  open,
  onOpenChange,
  children,
}: ResponsiveModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {children}
    </Sheet>
  );
}

// ─── Content ─────────────────────────────────────────────────────────
interface ResponsiveModalContentProps {
  children: React.ReactNode;
  className?: string;
  /** Extra classes only applied on desktop Dialog */
  dialogClassName?: string;
  /** Extra classes only applied on mobile Sheet */
  sheetClassName?: string;
  showCloseButton?: boolean;
}

function ResponsiveModalContent({
  children,
  className,
  dialogClassName,
  sheetClassName,
  showCloseButton = true,
}: ResponsiveModalContentProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <DialogContent
        className={cn(className, dialogClassName)}
        showCloseButton={showCloseButton}
      >
        {children}
      </DialogContent>
    );
  }

  return (
    <SheetContent
      side="bottom"
      className={cn(
        "max-h-[92dvh] flex flex-col rounded-t-2xl px-0 pb-0 gap-0",
        className,
        sheetClassName,
      )}
      showCloseButton={false}
    >
      {/* Drag handle pill */}
      <div className="mx-auto mt-2 mb-1 h-1.5 w-12 shrink-0 rounded-full bg-muted" />
      {children}
    </SheetContent>
  );
}

// ─── Header ──────────────────────────────────────────────────────────
function ResponsiveModalHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return <DialogHeader className={className} {...props} />;
  }

  return (
    <SheetHeader
      className={cn("px-5 pb-3 border-b shrink-0", className)}
      {...props}
    />
  );
}

// ─── Title ───────────────────────────────────────────────────────────
function ResponsiveModalTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return <DialogTitle className={className} {...props} />;
  }

  return <SheetTitle className={className} {...props} />;
}

// ─── Description ─────────────────────────────────────────────────────
function ResponsiveModalDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return <DialogDescription className={className} {...props} />;
  }

  return <SheetDescription className={className} {...props} />;
}

// ─── Body (scrollable area) ──────────────────────────────────────────
function ResponsiveModalBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto px-5 py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none",
        className,
      )}
      {...props}
    />
  );
}

// ─── Footer ──────────────────────────────────────────────────────────
function ResponsiveModalFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return <DialogFooter className={className} {...props} />;
  }

  return (
    <SheetFooter
      className={cn("px-5 py-4 border-t shrink-0", className)}
      {...props}
    />
  );
}

export {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalBody,
  ResponsiveModalFooter,
};
