"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/hooks/useSupabaseSession";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Flame,
  Timer,
  Target,
  Trophy,
  TrendingUp,
  CheckCircle2,
  Zap,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { UserNav } from "@/components/user-nav";
import Image from "next/image";

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

// ─── Animated Counter ────────────────────────────────────────────
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

// ─── Stat Card ───────────────────────────────────────────────────
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
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, type: "spring", stiffness: 120 }}
      whileHover={{ scale: 1.03, y: -2 }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm group"
    >
      {/* Glow background */}
      <div
        className={`absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity ${color}`}
      />
      <div className="flex items-center gap-3 mb-3">
        <motion.div
          whileHover={{ rotate: 12 }}
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${color} text-white shadow-md`}
        >
          <Icon className="h-5 w-5" />
        </motion.div>
        <span className="text-sm text-muted-foreground font-medium">
          {label}
        </span>
      </div>
      <div className="text-3xl font-bold tracking-tight">
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
        {suffix && (
          <span className="text-lg text-muted-foreground ml-1">{suffix}</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Bar Chart ───────────────────────────────────────────────────
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
    <div className="flex items-end gap-2 h-48 px-2">
      {data.map((d, i) => {
        const val = d[dataKey];
        const pct = Math.max((val / safeMax) * 100, val > 0 ? 4 : 0);
        const isToday = i === data.length - 1;

        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            {/* Value label */}
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 + i * 0.08 }}
              className="text-xs text-muted-foreground font-medium min-h-4"
            >
              {val > 0 ? formatLabel(val) : ""}
            </motion.span>

            {/* Bar */}
            <div
              className="w-full flex justify-center relative"
              style={{ height: "140px" }}
            >
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={{
                  duration: 0.8,
                  delay: 0.2 + i * 0.08,
                  type: "spring",
                  stiffness: 80,
                  damping: 15,
                }}
                className={`w-8 rounded-t-lg ${
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

            {/* Day label */}
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              className={`text-xs font-medium mt-1 ${
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

// ─── Streak Flame ────────────────────────────────────────────────
function StreakFlame({ streak }: { streak: number }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
      className="relative flex items-center justify-center"
    >
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, -3, 3, 0],
        }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        className="relative"
      >
        <Flame
          className={`h-16 w-16 ${
            streak > 0
              ? "text-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.5)]"
              : "text-muted-foreground/30"
          }`}
        />
        {streak > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="text-white font-bold text-lg mt-1">{streak}</span>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────
export default function StatsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [authStatus, router]);

  const fetchStats = useCallback(async () => {
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
    if (authStatus === "authenticated") {
      fetchStats();
    }
  }, [authStatus, fetchStats]);

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex items-center bg-background justify-center min-h-screen">
        <Image
          src="/background.webp"
          alt="Background"
          className="fixed w-full h-full object-cover opacity-90 dark:opacity-20 pointer-events-none"
          width={1920}
          height={1080}
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-12 w-12 rounded-full border-b-2 border-primary"
        />
      </div>
    );
  }

  if (!stats) return null;

  const maxFocus = Math.max(...stats.week.data.map((d) => d.focusTime), 1);
  const maxPomodoros = Math.max(...stats.week.data.map((d) => d.pomodoros), 1);

  return (
    <div className="min-h-screen bg-background">
      <Image
        src="/background.webp"
        alt="Background"
        className="fixed blur-sm w-full h-full object-cover opacity-0 dark:opacity-20 pointer-events-none"
        width={1920}
        height={1080}
      />

      <div className="container relative mx-auto p-6 max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push("/dashboard")}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Thống kê</h1>
              <p className="text-muted-foreground text-sm">
                Xin chào, <strong>{session?.user?.name}</strong> — Đây là bảng
                thống kê của bạn
              </p>
            </div>
          </div>
          <UserNav user={session?.user ?? undefined} />
        </motion.div>

        {/* Top Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
            delay={0.1}
          />
          <StatCard
            icon={CheckCircle2}
            label="Task hoàn thành"
            value={stats.today.tasks}
            color="bg-chart-4"
            delay={0.2}
          />
          <StatCard
            icon={Flame}
            label="Streak"
            value={stats.user.currentStreak}
            suffix="ngày"
            color="bg-chart-5"
            delay={0.3}
          />
        </div>

        {/* Streak + Week Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Streak Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center justify-center gap-3"
          >
            <StreakFlame streak={stats.user.currentStreak} />
            <div className="text-center">
              <p className="text-2xl font-bold">
                {stats.user.currentStreak > 0
                  ? `${stats.user.currentStreak} ngày liên tiếp!`
                  : "Bắt đầu streak!"}
              </p>
              <p className="text-sm text-muted-foreground">
                Kỷ lục: {stats.user.longestStreak} ngày
              </p>
            </div>
            {stats.user.currentStreak > 0 && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-1 rounded-full bg-linear-to-r from-orange-400 via-red-500 to-yellow-500"
              />
            )}
          </motion.div>

          {/* Week Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="md:col-span-2 rounded-2xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Tuần này</h3>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-primary" />
                  {formatTime(stats.week.focusTime)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-chart-2" />
                  {stats.week.pomodoros} pomodoro
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

        {/* Pomodoro weekly chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="rounded-2xl border border-border bg-card p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-chart-2" />
              <h3 className="font-semibold text-lg">Pomodoro tuần này</h3>
            </div>
          </div>
          <WeeklyBarChart
            data={stats.week.data}
            dataKey="pomodoros"
            maxVal={maxPomodoros}
            formatLabel={(v) => `${v}`}
            colorClass="bg-chart-2"
          />
        </motion.div>

        {/* All-time totals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <StatCard
            icon={Timer}
            label="Tổng thời gian"
            value={formatTime(stats.user.totalFocusTime)}
            color="bg-primary"
            delay={0.5}
          />
          <StatCard
            icon={Trophy}
            label="Tổng sessions"
            value={stats.totals.sessions}
            color="bg-chart-3"
            delay={0.6}
          />
          <StatCard
            icon={CheckCircle2}
            label="Tổng task"
            value={stats.totals.tasks}
            color="bg-chart-4"
            delay={0.7}
          />
          <StatCard
            icon={TrendingUp}
            label="Kỷ lục streak"
            value={stats.user.longestStreak}
            suffix="ngày"
            color="bg-chart-5"
            delay={0.8}
          />
        </motion.div>
      </div>
    </div>
  );
}
