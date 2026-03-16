"use client";

import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { motion } from "framer-motion";
import {
  Flame,
  Timer,
  Target,
  Trophy,
  TrendingUp,
  CheckCircle2,
  Zap,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { api } from "@/lib/api-client";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalBody,
} from "@/components/ui/responsive-modal";

const HeatMap = dynamic(() => import("@uiw/react-heat-map"), { ssr: false });

interface WeeklyDataPoint {
  label: string;
  date: string;
  focusTime: number;
  pomodoros: number;
  tasks: number;
}

interface DashboardStats {
  user: {
    totalFocusTime: number;
    currentStreak: number;
    longestStreak: number;
  };
  today: {
    focusTime: number;
    pomodoros: number;
    tasks: number;
  };
  week: {
    focusTime: number;
    pomodoros: number;
    data: WeeklyDataPoint[];
  };
  totals: {
    sessions: number;
    tasks: number;
  };
  heatmap?: { date: string; count: number }[];
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function formatTimeShort(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

function AnimatedNumber({
  value,
  duration = 1.2,
}: {
  value: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (end === 0) {
      setDisplay(0);
      return;
    }
    const stepTime = Math.max((duration * 1000) / end, 16);
    const step = Math.max(1, Math.floor(end / (duration * 60)));
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setDisplay(end);
        clearInterval(timer);
      } else {
        setDisplay(start);
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [value, duration]);

  return <>{display}</>;
}

// ─── Stat Card ────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  suffix = "",
  color,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  suffix?: string;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay, type: "spring", stiffness: 130 }}
      whileHover={{ scale: 1.03, y: -2 }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm group"
    >
      <div
        className={`absolute -top-6 -right-6 h-20 w-20 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity ${color}`}
      />
      <div className="flex items-center gap-2 mb-2">
        <motion.div
          whileHover={{ rotate: 12 }}
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${color} text-white shadow-sm`}
        >
          <Icon className="h-4 w-4" />
        </motion.div>
        <span className="text-xs text-muted-foreground font-medium">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold tracking-tight">
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
        {suffix && (
          <span className="text-sm text-muted-foreground ml-1">{suffix}</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Activity Data Transform ─────────────────────────────────────
const MONTHS_VI = [
  "Th1",
  "Th2",
  "Th3",
  "Th4",
  "Th5",
  "Th6",
  "Th7",
  "Th8",
  "Th9",
  "Th10",
  "Th11",
  "Th12",
];

function toHeatmapValue(raw: { date: string; count: number }[]) {
  return raw
    .filter((d) => d.count > 0)
    .map((d) => ({ date: d.date.replace(/-/g, "/"), count: d.count }));
}

// Each page = 10 full calendar months, aligned to month boundaries → no overlap
function getHeatmapWindow(pageOffset: number) {
  const today = new Date();
  const refYear = today.getFullYear();
  const refMonth = today.getMonth() + pageOffset * 10; // JS Date handles under/overflow
  const end = new Date(refYear, refMonth + 1, 0);
  const start = new Date(refYear, refMonth - 9, 1);
  return { start, end };
}

// ─── Bar Chart ────────────────────────────────────────────────────
function WeeklyBarChart({
  data,
  dataKey,
  maxVal,
  formatLabel,
  colorClass,
}: {
  data: WeeklyDataPoint[];
  dataKey: "focusTime" | "pomodoros";
  maxVal: number;
  formatLabel: (v: number) => string;
  colorClass: string;
}) {
  const safeMax = maxVal || 1;

  return (
    <div className="flex items-end gap-2 h-40 px-1">
      {data.map((d, i) => {
        const val = d[dataKey];
        const pct = Math.max((val / safeMax) * 100, val > 0 ? 4 : 0);
        const isToday = i === data.length - 1;

        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 + i * 0.07 }}
              className="text-xs text-muted-foreground font-medium min-h-4"
            >
              {val > 0 ? formatLabel(val) : ""}
            </motion.span>

            <div
              className="w-full flex justify-center relative"
              style={{ height: "110px" }}
            >
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={{
                  duration: 0.7,
                  delay: 0.15 + i * 0.07,
                  type: "spring",
                  stiffness: 80,
                  damping: 14,
                }}
                className={`w-7 rounded-t-lg ${
                  isToday
                    ? `${colorClass} shadow-lg shadow-primary/30`
                    : `${colorClass} opacity-60`
                } relative self-end`}
              >
                {isToday && val > 0 && (
                  <motion.div
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white"
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                )}
              </motion.div>
            </div>

            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 + i * 0.05 }}
              className={`text-xs font-medium ${
                isToday ? "text-primary font-bold" : "text-muted-foreground"
              }`}
            >
              {isToday ? "Nay" : d.label}
            </motion.span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Streak Flame ─────────────────────────────────────────────────
function StreakFlame({ streak }: { streak: number }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 200, delay: 0.25 }}
      className="relative flex items-center justify-center"
    >
      <motion.div
        animate={{ scale: [1, 1.1, 1], rotate: [0, -3, 3, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        className="relative"
      >
        <Flame
          className={`h-14 w-14 ${
            streak > 0
              ? "text-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.5)]"
              : "text-muted-foreground/30"
          }`}
        />
        {streak > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="text-white font-bold text-lg mt-1">{streak}</span>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Modal Content ────────────────────────────────────────────────
function StatsContent({ stats }: { stats: DashboardStats }) {
  const { resolvedTheme } = useTheme();
  const [heatmapPage, setHeatmapPage] = useState(0);
  const maxFocus = Math.max(...stats.week.data.map((d) => d.focusTime), 1);

  const rawHeatmap =
    stats.heatmap ??
    stats.week.data.map((d) => ({ date: d.date, count: d.pomodoros }));
  const { start: heatStart, end: heatEnd } = getHeatmapWindow(heatmapPage);
  const heatmapLabel = `${MONTHS_VI[heatStart.getMonth()]} ${heatStart.getFullYear()} – ${MONTHS_VI[heatEnd.getMonth()]} ${heatEnd.getFullYear()}`;

  return (
    <div className="space-y-5">
      {/* Today top cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={Timer}
          label="Hôm nay"
          value={formatTime(stats.today.focusTime)}
          color="bg-primary"
          delay={0}
        />
        <StatCard
          icon={Target}
          label="Pomodoro hôm nay"
          value={stats.today.pomodoros}
          color="bg-chart-2"
          delay={0.08}
        />
        <StatCard
          icon={CheckCircle2}
          label="Task hoàn thành"
          value={stats.today.tasks}
          color="bg-chart-4"
          delay={0.16}
        />
        <StatCard
          icon={Flame}
          label="Streak"
          value={stats.user.currentStreak}
          suffix="ngày"
          color="bg-chart-5"
          delay={0.24}
        />
      </div>

      {/* Streak + weekly focus time */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Streak card */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="rounded-2xl border border-border bg-card p-5 flex flex-col items-center justify-center gap-2"
        >
          <StreakFlame streak={stats.user.currentStreak} />
          <div className="text-center">
            <p className="text-xl font-bold">
              {stats.user.currentStreak > 0
                ? `${stats.user.currentStreak} ngày liên tiếp!`
                : "Bắt đầu streak!"}
            </p>
            <p className="text-xs text-muted-foreground">
              Kỷ lục: {stats.user.longestStreak} ngày
            </p>
          </div>
          {stats.user.currentStreak > 0 && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1, delay: 0.45 }}
              className="h-1 rounded-full bg-linear-to-r from-orange-400 via-red-500 to-yellow-500"
            />
          )}
        </motion.div>

        {/* Weekly focus time chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="sm:col-span-2 rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Thời gian tập trung (tuần)</h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-primary" />
                {formatTime(stats.week.focusTime)}
              </span>
            </div>
          </div>
          <WeeklyBarChart
            data={stats.week.data}
            dataKey="focusTime"
            maxVal={maxFocus}
            formatLabel={formatTimeShort}
            colorClass="bg-primary"
          />
        </motion.div>
      </div>

      {/* Pomodoro heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-chart-2" />
            <h3 className="font-semibold">Pomodoro</h3>
            <span className="text-xs text-muted-foreground">
              {heatmapLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Target className="h-3.5 w-3.5 text-chart-2" />
              {stats.week.pomodoros} tuần này
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setHeatmapPage((p) => p - 1)}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card hover:bg-accent transition-colors"
                title="Tuần trước"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setHeatmapPage((p) => p + 1)}
                disabled={heatmapPage >= 1}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Tuần sau"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <HeatMap
            value={toHeatmapValue(rawHeatmap)}
            startDate={heatStart}
            endDate={heatEnd}
            weekLabels={["", "T2", "", "T4", "", "T6", ""]}
            monthLabels={MONTHS_VI}
            rectSize={12}
            space={2}
            rectProps={{ rx: 2 }}
            panelColors={
              resolvedTheme === "dark"
                ? {
                    1: "#374151",
                    3: "#7c2d12",
                    5: "#c2410c",
                    7: "#f97316",
                    9: "#fdba74",
                  }
                : {
                    1: "#e5e7eb",
                    3: "#fed7aa",
                    5: "#fb923c",
                    7: "#f97316",
                    9: "#c2410c",
                  }
            }
            rectRender={(props, data) => (
              <g>
                {data.count != null && data.count > 0 && (
                  <title>{`${data.count} 🍅 • ${data.date}`}</title>
                )}
                <rect {...props} />
              </g>
            )}
            style={
              {
                "--rhm-rect": resolvedTheme === "dark" ? "#374151" : "#e5e7eb",
                width: "100%",
              } as CSSProperties
            }
          />
        </div>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={Timer}
          label="Tổng thời gian"
          value={formatTime(stats.user.totalFocusTime)}
          color="bg-primary"
          delay={0.35}
        />
        <StatCard
          icon={Trophy}
          label="Tổng sessions"
          value={stats.totals.sessions}
          color="bg-chart-3"
          delay={0.42}
        />
        <StatCard
          icon={CheckCircle2}
          label="Tổng task xong"
          value={stats.totals.tasks}
          color="bg-chart-4"
          delay={0.49}
        />
        <StatCard
          icon={TrendingUp}
          label="Kỷ lục streak"
          value={stats.user.longestStreak}
          suffix="ngày"
          color="bg-chart-5"
          delay={0.56}
        />
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────
export function StatsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setStats(null);
    try {
      const data = await api.get<DashboardStats>(
        "/focus-sessions/stats/dashboard",
      );
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchStats();
  }, [open, fetchStats]);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        dialogClassName="sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none"
        className="p-0 gap-0"
        showCloseButton={false}
      >
        {/* Header */}
        <ResponsiveModalHeader className="sticky top-0 z-10 flex-row items-center justify-between px-6 py-4 border-b border-border bg-background/95 backdrop-blur-sm gap-0">
          <ResponsiveModalTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <TrendingUp className="h-4 w-4" />
            </div>
            Thống kê
          </ResponsiveModalTitle>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </motion.button>
        </ResponsiveModalHeader>

        {/* Body */}
        <ResponsiveModalBody>
          {loading && (
            <div className="flex items-center justify-center py-16 ">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="h-10 w-10 rounded-full border-b-2 border-primary"
              />
            </div>
          )}
          {!loading && stats && <StatsContent stats={stats} />}
        </ResponsiveModalBody>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
