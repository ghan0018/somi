import { TreatmentPlanModel } from '../models/treatment-plan.model.js';
import { CompletionEventModel } from '../models/completion-event.model.js';
import { notFound } from '../lib/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the Monday of the week containing `date`.
 * The returned date has its time set to 00:00:00.000 UTC.
 */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Add `days` calendar days to `date` (returns a new Date). */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Format a Date as YYYY-MM-DD (local-wall using UTC getters to stay consistent). */
function toDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Compute totalAssigned for a given published plan.
 * assigned = sum over all sessions of (assignments.length × timesPerDay).
 */
function computeDailyAssigned(sessions: { assignments: unknown[]; timesPerDay: number }[]): number {
  return sessions.reduce((sum, s) => sum + s.assignments.length * s.timesPerDay, 0);
}

// ---------------------------------------------------------------------------
// Weekly adherence
// ---------------------------------------------------------------------------

export interface DayAdherence {
  date: string;
  assigned: number;
  completed: number;
}

export interface WeeklyAdherenceResult {
  patientId: string;
  weekStart: string;
  weekEnd: string;
  days: DayAdherence[];
  summary: {
    totalAssigned: number;
    totalCompleted: number;
    rate: number;
  };
}

export async function getWeeklyAdherence(
  patientId: string,
  weekStartParam?: string,
): Promise<WeeklyAdherenceResult> {
  // Determine the week's Monday
  const baseDate = weekStartParam ? new Date(`${weekStartParam}T00:00:00.000Z`) : new Date();
  const weekStart = getMonday(baseDate);
  const weekEnd = addDays(weekStart, 6); // Sunday

  const weekStartStr = toDateLocal(weekStart);
  const weekEndStr = toDateLocal(weekEnd);

  // Find the published plan
  const plan = await TreatmentPlanModel.findOne({ patientId, status: 'published' }).lean();
  if (!plan) {
    throw notFound(`No published treatment plan found for patient '${patientId}'`);
  }

  const dailyAssigned = computeDailyAssigned(plan.sessions);

  // Build the 7 date strings (Mon … Sun)
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(toDateLocal(addDays(weekStart, i)));
  }

  // Count completions per dateLocal in one query
  const completionDocs = await CompletionEventModel.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        patientId,
        dateLocal: { $gte: weekStartStr, $lte: weekEndStr },
      },
    },
    {
      $group: {
        _id: '$dateLocal',
        count: { $sum: 1 },
      },
    },
  ]);

  const completionsByDate = new Map<string, number>(
    completionDocs.map((d) => [d._id, d.count]),
  );

  const days: DayAdherence[] = dates.map((date) => ({
    date,
    assigned: dailyAssigned,
    completed: completionsByDate.get(date) ?? 0,
  }));

  const totalAssigned = days.reduce((s, d) => s + d.assigned, 0);
  const totalCompleted = days.reduce((s, d) => s + d.completed, 0);
  const rate = totalAssigned === 0 ? 0 : Math.round((totalCompleted / totalAssigned) * 100) / 100;

  return {
    patientId,
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    days,
    summary: { totalAssigned, totalCompleted, rate },
  };
}

// ---------------------------------------------------------------------------
// Overall adherence
// ---------------------------------------------------------------------------

export interface WeekSummary {
  weekStart: string;
  rate: number;
  successful: boolean;
}

export interface OverallAdherenceResult {
  patientId: string;
  planId: string;
  weeks: WeekSummary[];
  summary: {
    totalWeeks: number;
    successfulWeeks: number;
    overallRate: number;
  };
}

export async function getOverallAdherence(patientId: string): Promise<OverallAdherenceResult> {
  const plan = await TreatmentPlanModel.findOne({ patientId, status: 'published' }).lean();
  if (!plan) {
    throw notFound(`No published treatment plan found for patient '${patientId}'`);
  }

  const planId = String(plan._id);
  const publishedAt = plan.publishedAt ?? plan.createdAt;
  const now = new Date();

  const dailyAssigned = computeDailyAssigned(plan.sessions);

  // Build list of week starts (Mondays) from publishedAt up to the current week
  const firstMonday = getMonday(publishedAt);
  const currentMonday = getMonday(now);

  const weekStarts: Date[] = [];
  let cursor = new Date(firstMonday);
  while (cursor <= currentMonday) {
    weekStarts.push(new Date(cursor));
    cursor = addDays(cursor, 7);
  }

  if (weekStarts.length === 0) {
    return {
      patientId,
      planId,
      weeks: [],
      summary: { totalWeeks: 0, successfulWeeks: 0, overallRate: 0 },
    };
  }

  // Fetch all completions since publishedAt in one query
  const rangeStart = toDateLocal(firstMonday);
  const rangeEnd = toDateLocal(addDays(currentMonday, 6));

  const completionDocs = await CompletionEventModel.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        patientId,
        dateLocal: { $gte: rangeStart, $lte: rangeEnd },
      },
    },
    {
      $group: {
        _id: '$dateLocal',
        count: { $sum: 1 },
      },
    },
  ]);

  const completionsByDate = new Map<string, number>(
    completionDocs.map((d) => [d._id, d.count]),
  );

  // Build per-week stats
  const weeks: WeekSummary[] = weekStarts.map((weekStart) => {
    let totalCompleted = 0;
    let totalAssigned = 0;

    for (let i = 0; i < 7; i++) {
      const dayStr = toDateLocal(addDays(weekStart, i));
      // Only count days up to today
      if (dayStr > toDateLocal(now)) break;
      totalAssigned += dailyAssigned;
      totalCompleted += completionsByDate.get(dayStr) ?? 0;
    }

    const rate =
      totalAssigned === 0 ? 0 : Math.round((totalCompleted / totalAssigned) * 100) / 100;

    return {
      weekStart: toDateLocal(weekStart),
      rate,
      successful: rate >= 0.8,
    };
  });

  const totalWeeks = weeks.length;
  const successfulWeeks = weeks.filter((w) => w.successful).length;
  const sumRate = weeks.reduce((s, w) => s + w.rate, 0);
  const overallRate =
    totalWeeks === 0 ? 0 : Math.round((sumRate / totalWeeks) * 100) / 100;

  return {
    patientId,
    planId,
    weeks,
    summary: { totalWeeks, successfulWeeks, overallRate },
  };
}
