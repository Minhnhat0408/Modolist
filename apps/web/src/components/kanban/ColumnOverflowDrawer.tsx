"use client";

/**
 * ColumnOverflowDrawer — responsive overlay for viewing all tasks in a column.
 *
 * Features:
 * - Desktop (≥ 768px): Centered Dialog with internal scrolling.
 * - Mobile (< 768px): Bottom Sheet that slides up.
 * - Search by title / description
 * - Date filter (by createdAt / dueDate / completedAt)
 * - Tasks grouped by date sections
 *
 * Reuses TaskCard inside a no-op DndContext so useSortable doesn't throw.
 */

import { useMemo, useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { KanbanTask, KANBAN_COLUMNS } from "@/types/kanban";
import { TaskStatus } from "@/types/database";
import { TaskCard } from "./TaskCard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { DndContext } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Search, CalendarDays, X } from "lucide-react";

interface ColumnOverflowDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  status: TaskStatus;
  tasks: KanbanTask[];
  onEditTask?: (task: KanbanTask) => void;
  onStartFocus?: (task: KanbanTask) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Get the relevant date for grouping based on column status */
function getGroupDate(task: KanbanTask, status: TaskStatus): Date {
  if (status === TaskStatus.DONE && task.completedAt) {
    return new Date(task.completedAt);
  }
  if (task.dueDate) {
    return new Date(task.dueDate);
  }
  return new Date(task.createdAt);
}

/** Format a date as a readable, localized section header */
function formatSectionDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Hôm qua";
  if (diff === -1) return "Ngày mai";
  if (diff > 1 && diff <= 7) return `${diff} ngày trước`;
  if (diff < -1 && diff >= -7) return `${Math.abs(diff)} ngày nữa`;

  return target.toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: target.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/** Date key for grouping (YYYY-MM-DD) */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Check if two dates are the same calendar day */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ── TaskGroupedList ──────────────────────────────────────────────────

function TaskGroupedList({
  tasks,
  status,
  onEditTask,
  onStartFocus,
  accent,
}: {
  tasks: KanbanTask[];
  status: TaskStatus;
  onEditTask?: (task: KanbanTask) => void;
  onStartFocus?: (task: KanbanTask) => void;
  accent: typeof KANBAN_COLUMNS[TaskStatus]["accent"];
}) {
  // Group tasks by date
  const groups = useMemo(() => {
    const map = new Map<string, { date: Date; tasks: KanbanTask[] }>();

    for (const task of tasks) {
      const d = getGroupDate(task, status);
      const key = dateKey(d);
      if (!map.has(key)) {
        map.set(key, { date: d, tasks: [] });
      }
      map.get(key)!.tasks.push(task);
    }

    // Sort groups: newest first
    const sorted = [...map.entries()].sort((a, b) => {
      return b[1].date.getTime() - a[1].date.getTime();
    });

    return sorted.map(([key, val]) => ({
      key,
      label: formatSectionDate(val.date),
      tasks: val.tasks,
    }));
  }, [tasks, status]);

  // If only 1 group, don't show section header (avoid noise)
  const showHeaders = groups.length > 1;

  return (
    <DndContext onDragEnd={() => {}}>
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.key}>
              {showHeaders && (
                <div className={`sticky top-0 z-10 flex items-center gap-2 py-2 px-1 mb-2 ${accent.dateStickyBg} backdrop-blur-sm rounded-lg`}>
                  <CalendarDays className={`h-3.5 w-3.5 ${accent.dateIconCls}`} />
                  <span className={`text-xs font-semibold ${accent.dateLabelCls} uppercase tracking-wider`}>
                    {group.label}
                  </span>
                  <Badge
                    variant="outline"
                    className={`h-5 min-w-5 px-1.5 rounded-full text-[10px] ${accent.badgeCls}`}
                  >
                    {group.tasks.length}
                  </Badge>
                </div>
              )}
              <div className="space-y-3">
                {group.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={onEditTask}
                    onStartFocus={onStartFocus}
                    showCreatedDate={status === TaskStatus.BACKLOG}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ── Filter Bar ───────────────────────────────────────────────────────

function FilterBar({
  searchQuery,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  totalCount,
  filteredCount,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  dateFilter: string;
  onDateFilterChange: (d: string) => void;
  totalCount: number;
  filteredCount: number;
}) {
  return (
    <div className="space-y-2.5">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm theo tên, mô tả..."
          className="pl-9 pr-9 h-9 bg-white/5 border-white/10 focus:border-primary/50 text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Date filter + result count */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => onDateFilterChange(e.target.value)}
            className="pl-9 pr-8 h-8 bg-white/5 border-white/10 focus:border-primary/50 text-xs"
          />
          {dateFilter && (
            <button
              onClick={() => onDateFilterChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {(searchQuery || dateFilter) && filteredCount !== totalCount && (
          <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
            {filteredCount}/{totalCount}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export function ColumnOverflowDrawer({
  open,
  onOpenChange,
  title,
  status,
  tasks,
  onEditTask,
  onStartFocus,
}: ColumnOverflowDrawerProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const accent = KANBAN_COLUMNS[status].accent;

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Reset filters when drawer closes
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSearchQuery("");
      setDateFilter("");
    }
    onOpenChange(v);
  };

  // Apply filters
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Search by title or description
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)),
      );
    }

    // Filter by date
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      result = result.filter((t) => {
        const taskDate = getGroupDate(t, status);
        return isSameDay(taskDate, filterDate);
      });
    }

    return result;
  }, [tasks, searchQuery, dateFilter, status]);

  const description = `${tasks.length} nhiệm vụ`;

  const filterBar = (
    <FilterBar
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      dateFilter={dateFilter}
      onDateFilterChange={setDateFilter}
      totalCount={tasks.length}
      filteredCount={filteredTasks.length}
    />
  );

  const taskContent =
    filteredTasks.length === 0 ? (
      <div className="text-center py-8 text-sm text-muted-foreground">
        {searchQuery || dateFilter
          ? "Không tìm thấy nhiệm vụ phù hợp"
          : "Chưa có nhiệm vụ"}
      </div>
    ) : (
      <TaskGroupedList
        tasks={filteredTasks}
        status={status}
        accent={accent}
        onEditTask={onEditTask}
        onStartFocus={onStartFocus}
      />
    );

  // ── Desktop: Dialog ──────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={`sm:max-w-lg max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden border ${accent.headerBorder}`}
          showCloseButton
        >
          <DialogHeader className={`px-6 pt-6 pb-4 border-b ${accent.headerBorder} shrink-0 space-y-3 ${accent.headerBg}`}>
            <div className="flex items-center gap-3">
              <DialogTitle>{title}</DialogTitle>
              <Badge
                variant="outline"
                className={`h-6 min-w-6 px-2 rounded-full ${accent.badgeCls}`}
              >
                {tasks.length}
              </Badge>
            </div>
            <DialogDescription className="sr-only">{description}</DialogDescription>
            {filterBar}
          </DialogHeader>

          <div className="overflow-y-auto flex-1 px-6 py-4">{taskContent}</div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Mobile: Bottom Sheet ─────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className={`max-h-[90dvh] flex flex-col rounded-t-2xl px-0 pb-0 gap-0 border-t ${accent.headerBorder}`}
        showCloseButton={false}
      >
        {/* Drag handle */}
        <div className={`mx-auto mt-2 mb-1 h-1.5 w-12 shrink-0 rounded-full ${accent.handle}`} />

        <SheetHeader className={`px-5 pb-3 border-b ${accent.headerBorder} shrink-0 space-y-3 ${accent.headerBg}`}>
          <div className="flex items-center gap-3">
            <SheetTitle>{title}</SheetTitle>
            <Badge
              variant="outline"
              className={`h-6 min-w-6 px-2 rounded-full ${accent.badgeCls}`}
            >
              {tasks.length}
            </Badge>
          </div>
          <SheetDescription className="sr-only">{description}</SheetDescription>
          {filterBar}
        </SheetHeader>

        <div className="overflow-y-auto flex-1 px-4 py-4">{taskContent}</div>
      </SheetContent>
    </Sheet>
  );
}

