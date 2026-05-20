import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  ReferenceDot,
} from "recharts";
import { getDashboardData, type DashboardData } from "../api";
import { useAuth } from "../hooks/useAuth";
import CustomDropdown from "./CustomDropdown";

// Helper function to get local date string from UTC timestamp
function getLocalDateString(utcTimestamp: string): string {
  const date = new Date(utcTimestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isMedicationEvent(event: { event_type: string }): boolean {
  return event.event_type.trim().toLowerCase() === "medication";
}

// Helper function to aggregate data by local date
function aggregateDataByLocalDate(
  headaches: DashboardData["headaches"],
  events: DashboardData["events"],
  daysRequested: number,
  hrv: DashboardData["hrv"],
) {
  const hrvMsByDate = new Map(
    (hrv ?? []).map((row) => [row.civil_date, row.daily_rmssd_ms] as const),
  );
  // Group headaches by local date
  const headachesByDate = headaches.reduce(
    (acc, headache) => {
      const localDate = getLocalDateString(headache.timestamp);
      if (!acc[localDate]) acc[localDate] = [];
      acc[localDate].push(headache);
      return acc;
    },
    {} as Record<string, typeof headaches>,
  );

  // Group events by local date
  const eventsByDate = events.reduce(
    (acc, event) => {
      const localDate = getLocalDateString(event.timestamp);
      if (!acc[localDate]) acc[localDate] = [];
      acc[localDate].push(event);
      return acc;
    },
    {} as Record<string, typeof events>,
  );

  // Generate all dates in range using local time
  const result = [];
  let startDate: Date;
  if (daysRequested <= 0) {
    const stamps = [
      ...headaches.map((h) => h.timestamp),
      ...events.map((e) => e.timestamp),
      ...(hrv ?? [])
        .filter((row) => row.civil_date)
        .map((row) => `${row.civil_date}T12:00:00.000Z`),
    ];
    if (stamps.length === 0) {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
    } else {
      const earliest = new Date(
        Math.min(...stamps.map((t) => new Date(t).getTime())),
      );
      startDate = new Date(
        earliest.getFullYear(),
        earliest.getMonth(),
        earliest.getDate(),
      );
    }
  } else {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - daysRequested + 1); // Include today
    startDate.setHours(0, 0, 0, 0);
  }

  const endDay = new Date();
  endDay.setHours(0, 0, 0, 0);

  for (let d = new Date(startDate); d <= endDay; d.setDate(d.getDate() + 1)) {
    const dateStr = getLocalDateString(d.toISOString());
    const dayHeadaches = headachesByDate[dateStr] || [];
    const dayEvents = eventsByDate[dateStr] || [];

    // Calculate stats for this day
    const severities = dayHeadaches.map((h) => h.severity);
    // Use 0 when there are no headaches so Recharts draws continuous lines at the baseline instead of gaps.
    const minSeverity = severities.length > 0 ? Math.min(...severities) : 0;
    const maxSeverity = severities.length > 0 ? Math.max(...severities) : 0;
    const avgSeverity =
      severities.length > 0
        ? Math.round(
            (severities.reduce((sum, s) => sum + s, 0) / severities.length) *
              10,
          ) / 10
        : 0;
    const auraCount = dayHeadaches.filter((h) => h.aura === 1).length;
    const medicationCount = dayEvents.filter(isMedicationEvent).length;
    const rawHrv = hrvMsByDate.get(dateStr);
    const hrvRmssdMs =
      rawHrv != null && typeof rawHrv === "number" && Number.isFinite(rawHrv) && rawHrv > 0
        ? rawHrv
        : null;

    result.push({
      date: dateStr,
      displayDate: new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      min_severity: minSeverity,
      max_severity: maxSeverity,
      avg_severity: avgSeverity,
      headache_count: dayHeadaches.length,
      aura_count: auraCount,
      has_aura: auraCount > 0,
      events_count: dayEvents.length,
      medication_count: medicationCount,
      events: dayEvents,
      headaches: dayHeadaches.map((h, idx) => ({
        id: `${dateStr}-${idx}`,
        timestamp: h.timestamp,
        severity: h.severity,
        aura: h.aura === 1,
      })),
      hrv_rmssd_ms: hrvRmssdMs,
    });
  }

  return result;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  min_severity: number;
  max_severity: number;
  avg_severity: number;
  headache_count: number;
  aura_count: number;
  has_aura: boolean;
  events_count: number;
  /** Count of medication-type events that day (blue bars, right axis). */
  medication_count: number;
  events: Array<{
    event_type: string;
    value: string;
    timestamp: string;
  }>;
  headaches: Array<{
    id: string;
    timestamp: string;
    severity: number;
    aura: boolean;
  }>;
  /** Daily RMSSD from Google Health (ms), matched by civil date; null when absent. */
  hrv_rmssd_ms: number | null;
}

/** Line points at y=0 for no-headache days; omit visible dots on those days (line still connects). */
function lineDotSkipZeroHeadacheDays(compact: boolean, fill: string) {
  return (props: { cx?: number; cy?: number; payload?: ChartDataPoint }) => {
    const p = props.payload;
    if (p == null || p.headache_count === 0) {
      return <g />;
    }
    const r = compact ? 2 : 3;
    return (
      <circle
        cx={props.cx}
        cy={props.cy}
        r={r}
        fill={fill}
        strokeWidth={2}
      />
    );
  };
}

// Map severity values (0-10) to colors using theme variables
// Matches the color scheme used in HeadacheEntryForm buttons
function getSeverityColor(severity: number): string {
  if (severity <= 3) {
    return "var(--color-neon-lime)";
  }
  if (severity <= 6) {
    return "var(--color-attention)";
  }
  if (severity <= 8) {
    return "var(--color-warn)";
  }
  return "var(--color-alert)";
}

interface BarDataPoint {
  displayDate: string;
  severity: number;
  id: string;
  aura: boolean;
  timestamp: string;
  color: string;
  dateData: ChartDataPoint; // reference to full day data for tooltip
}

// Transform aggregated chart data into individual bar data points
// Returns a flat array where each element represents one bar to render
function transformDataForBars(chartData: ChartDataPoint[]): BarDataPoint[] {
  const barData: BarDataPoint[] = [];
  
  chartData.forEach((dayData) => {
    dayData.headaches.forEach((headache) => {
      barData.push({
        displayDate: dayData.displayDate,
        severity: headache.severity,
        id: headache.id,
        aura: headache.aura,
        timestamp: headache.timestamp,
        color: getSeverityColor(headache.severity),
        dateData: dayData,
      });
    });
  });
  
  return barData;
}

// Merge bar data back into chart data structure for Recharts
// This creates dynamic properties for each headache entry
function mergeBarDataIntoChartData(chartData: ChartDataPoint[], barData: BarDataPoint[]) {
  const merged = chartData.map(day => ({ ...day }));
  
  barData.forEach((bar, index) => {
    const dayIndex = merged.findIndex(d => d.displayDate === bar.displayDate);
    if (dayIndex >= 0) {
      // Add a unique property for this headache entry
      (merged[dayIndex] as Record<string, unknown>)[`headache_${index}`] = bar.severity;
    }
  });
  
  return merged;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: BarDataPoint | ChartDataPoint; dataKey?: string }>;
}) {
  if (!active || !payload || !payload.length) return null;

  // Determine if hovering over a bar (BarDataPoint) or line (ChartDataPoint)
  const firstPayload = payload[0].payload;
  const isBarHover = "dateData" in firstPayload;
  
  if (isBarHover) {
    // Individual bar tooltip
    const barData = firstPayload as BarDataPoint;
    const dayData = barData.dateData;
    const timestamp = new Date(barData.timestamp);
    const timeStr = timestamp.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return (
      <div className="panel bg-[--color-panel] border border-[--color-neon-violet] p-3 rounded-lg shadow-lg">
        <p className="text-sm font-display text-[--color-neon-cyan] mb-2">
          {dayData.displayDate}
        </p>

        {/* Individual Entry */}
        <div className="space-y-1 text-xs mb-2 pb-2 border-b border-[--color-neon-violet]">
          <p className="font-semibold text-[--color-attention]">Individual Entry:</p>
          <p>
            <span className="text-[--color-subtle]">Time:</span> {timeStr}
          </p>
          <p>
            <span className="text-[--color-subtle]">Severity:</span> {barData.severity}/10
          </p>
          <p>
            <span className="text-[--color-subtle]">Aura:</span>{" "}
            {barData.aura ? (
              <span className="text-[--color-alert]">Yes 🌟</span>
            ) : (
              "No"
            )}
          </p>
        </div>

        {/* Daily Summary */}
        {dayData.headache_count > 1 && (
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-[--color-attention]">Daily Summary:</p>
            <p>
              <span className="text-[--color-subtle]">Total:</span> {dayData.headache_count} headaches
            </p>
            <p>
              <span className="text-[--color-subtle]">Range:</span>{" "}
              {dayData.min_severity} - {dayData.max_severity}
            </p>
            <p>
              <span className="text-[--color-subtle]">Average:</span> {dayData.avg_severity}
            </p>
          </div>
        )}

        {dayData.medication_count > 0 && (
          <p className="text-xs font-medium text-[#93c5fd] mt-1">
            Medication logged: {dayData.medication_count}
          </p>
        )}

        {dayData.hrv_rmssd_ms != null && dayData.hrv_rmssd_ms > 0 && (
          <p className="text-xs font-medium text-[#d8b4fe] mt-1">
            HRV: {Math.round(dayData.hrv_rmssd_ms)} ms
          </p>
        )}

        {dayData.events.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[--color-neon-violet]">
            <p className="text-xs text-[--color-attention] mb-1">
              Events ({dayData.events.length}):
            </p>
            {dayData.events.slice(0, 2).map((event, i) => (
              <p key={i} className="text-xs text-[--color-subtle]">
                • [{event.event_type}]{" "}
                {event.value.length > 20
                  ? event.value.substring(0, 20) + "..."
                  : event.value}
              </p>
            ))}
            {dayData.events.length > 2 && (
              <p className="text-xs text-[--color-subtle] italic">
                ...and {dayData.events.length - 2} more
              </p>
            )}
          </div>
        )}
      </div>
    );
  } else {
    // Line or day summary tooltip
    const data = firstPayload as ChartDataPoint;

    return (
      <div className="panel bg-[--color-panel] border border-[--color-neon-violet] p-3 rounded-lg shadow-lg">
        <p className="text-sm font-display text-[--color-neon-cyan] mb-2">
          {data.displayDate}
        </p>

        {data.headache_count > 0 ? (
          <div className="space-y-1 text-xs">
            <p>
              <span className="text-[--color-subtle]">Count:</span>{" "}
              {data.headache_count} headache{data.headache_count > 1 ? "s" : ""}
            </p>
            <p>
              <span className="text-[--color-subtle]">Severity:</span>{" "}
              {data.min_severity === data.max_severity
                ? data.min_severity
                : `${data.min_severity} - ${data.max_severity}`}
            </p>
            <p>
              <span className="text-[--color-subtle]">Average:</span>{" "}
              {data.avg_severity}
            </p>
            {data.has_aura && (
              <p className="text-[--color-alert]">🌟 Aura present</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-[--color-subtle]">No headaches</p>
        )}

        {data.medication_count > 0 && (
          <p className="text-xs font-medium text-[#93c5fd] mt-1">
            Medication logged: {data.medication_count}
          </p>
        )}

        {data.hrv_rmssd_ms != null && data.hrv_rmssd_ms > 0 && (
          <p className="text-xs font-medium text-[#d8b4fe] mt-1">
            HRV: {Math.round(data.hrv_rmssd_ms)} ms
          </p>
        )}

        {data.events.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[--color-neon-violet]">
            <p className="text-xs text-[--color-attention] mb-1">
              Events ({data.events.length}):
            </p>
            {data.events.slice(0, 3).map((event, i) => (
              <p key={i} className="text-xs text-[--color-subtle]">
                • [{event.event_type}]{" "}
                {event.value.length > 20
                  ? event.value.substring(0, 20) + "..."
                  : event.value}
              </p>
            ))}
            {data.events.length > 3 && (
              <p className="text-xs text-[--color-subtle] italic">
                ...and {data.events.length - 3} more
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
}

interface DashboardChartProps {
  days?: number;
  height?: number;
  showControls?: boolean;
  showTitle?: boolean;
  compact?: boolean;
  onDataChange?: (data: DashboardData | null) => void;
  refreshTrigger?: number;
}

/**
 * Dashboard chart component that visualizes headache data over time.
 * 
 * Features:
 * - Individual bars for each headache entry, grouped by day
 * - Severity-based color coding (0-3: lime green, 4-6: yellow/orange, 7-8: orange, 9-10: red)
 * - Red dots on bars with aura
 * - Line chart showing daily average severity
 * - Blue bars (right axis) for medication count per day; green dots for other events
 * - Interactive tooltips showing individual entry details + daily summary
 */
export default function DashboardChart({
  days: initialDays = 30,
  height = 320,
  showControls = false,
  showTitle = true,
  compact = false,
  onDataChange,
  refreshTrigger = 0,
}: DashboardChartProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(initialDays);
  const { fetchWithAuth } = useAuth();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dashboardData = await getDashboardData(days, fetchWithAuth);
      setData(dashboardData);
      onDataChange?.(dashboardData);
    } catch (e: unknown) {
      setError(
        (e instanceof Error ? e.message : String(e)) ||
          "Failed to load dashboard data",
      );
      onDataChange?.(null);
    } finally {
      setLoading(false);
    }
  }, [days, fetchWithAuth, onDataChange]);

  useEffect(() => {
    loadData();
  }, [days, refreshTrigger, loadData]);

  const chartData: ChartDataPoint[] = data
    ? aggregateDataByLocalDate(data.headaches, data.events, data.days_requested, data.hrv ?? [])
    : [];
  
  const barData: BarDataPoint[] = transformDataForBars(chartData);
  const mergedData = mergeBarDataIntoChartData(chartData, barData);

  const medicationAxisMax = useMemo(() => {
    const m = chartData.reduce((acc, d) => Math.max(acc, d.medication_count), 0);
    return Math.max(1, m);
  }, [chartData]);

  const hasHrvChart = useMemo(
    () => chartData.some((d) => d.hrv_rmssd_ms != null && d.hrv_rmssd_ms > 0),
    [chartData],
  );

  const hrvAxisMax = useMemo(() => {
    const m = chartData.reduce((acc, d) => Math.max(acc, d.hrv_rmssd_ms ?? 0), 0);
    return Math.max(50, Math.ceil(m * 1.1));
  }, [chartData]);

  // Only show individual bars for short windows (never for all-time — too many days)
  const showIndividualBars = days > 0 && days < 10;

  if (loading) {
    return (
      <div className="panel text-center py-8">
        <p className="text-[--color-subtle]">Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <p className="text-[--color-alert]">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="flex items-center justify-between mb-4">
        {showTitle && (
          <h3
            className={`font-display ${compact ? "text-lg" : "text-xl"} text-[--color-attention]`}
          >
            {compact ? "Recent Trends" : "Headache Severity Trends"}
          </h3>
        )}
        {showControls && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[--color-subtle]">Days:</span>
              <CustomDropdown
                value={days}
                onChange={setDays}
                options={[
                  { value: 7, label: "7 days" },
                  { value: 14, label: "14 days" },
                  { value: 30, label: "30 days" },
                  { value: 60, label: "60 days" },
                  { value: 90, label: "90 days" },
                  { value: 0, label: "All Time" },
                ]}
              />
            </div>
          </div>
        )}
      </div>

      <div className="w-full" style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={mergedData}
            margin={{
              top: 20,
              right: compact ? (hasHrvChart ? 58 : 34) : (hasHrvChart ? 76 : 44),
              left: 12,
              bottom: 5,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="color-mix(in oklch, var(--color-neon-violet) 20%, transparent)"
            />
            <XAxis
              dataKey="displayDate"
              stroke="var(--color-subtle)"
              fontSize={compact ? 10 : 12}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              yAxisId="severity"
              orientation="left"
              stroke="var(--color-subtle)"
              tick={{ fill: "var(--color-subtle)", fontSize: compact ? 10 : 12 }}
              domain={[0, 10]}
              label={
                !compact
                  ? {
                      value: "Severity (0–10)",
                      angle: -90,
                      position: "insideLeft",
                      fill: "var(--color-subtle)",
                      fontSize: 11,
                    }
                  : undefined
              }
            />
            <YAxis
              yAxisId="medication"
              orientation="right"
              stroke="#60a5fa"
              tick={{ fill: "#93c5fd", fontSize: compact ? 9 : 11 }}
              domain={[0, medicationAxisMax]}
              allowDecimals={false}
              width={compact ? 30 : 38}
              label={
                !compact
                  ? {
                      value: "Medication / day",
                      angle: 90,
                      position: "insideRight",
                      fill: "#93c5fd",
                      fontSize: 11,
                    }
                  : undefined
              }
            />
            {hasHrvChart && (
              <YAxis
                yAxisId="hrvRmssd"
                orientation="right"
                stroke="#c084fc"
                tick={{ fill: "#d8b4fe", fontSize: compact ? 8 : 10 }}
                domain={[0, hrvAxisMax]}
                width={compact ? 26 : 32}
                offset={compact ? 26 : 34}
                label={
                  !compact
                    ? {
                        value: "HRV (ms)",
                        angle: 90,
                        position: "insideRight",
                        fill: "#d8b4fe",
                        fontSize: 10,
                      }
                    : undefined
                }
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            {!compact && <Legend />}

            {/* Medication count per day (right Y axis); drawn under severity lines */}
            <Bar
              yAxisId="medication"
              dataKey="medication_count"
              name="Medication"
              fill="#3b82f6"
              fillOpacity={0.88}
              barSize={compact ? 7 : 11}
              radius={[3, 3, 0, 0]}
              legendType="square"
            />

            {/* Individual headache severity bars - only show for short date ranges */}
            {showIndividualBars && barData.map((entry, index) => (
              <Bar
                key={`bar-${index}`}
                yAxisId="severity"
                dataKey={`headache_${index}`}
                fill={entry.color}
                barSize={compact ? 6 : 10}
                name={index === 0 ? "Severity" : undefined}
                legendType={index === 0 ? "square" : "none"}
              />
            ))}

            {/* Average line */}
            <Line
              yAxisId="severity"
              type="monotone"
              dataKey="avg_severity"
              stroke="var(--color-attention)"
              strokeWidth={2}
              dot={lineDotSkipZeroHeadacheDays(compact, "var(--color-attention)")}
              name="Average Severity"
            />

            {/* Max severity line */}
            <Line
              yAxisId="severity"
              type="monotone"
              dataKey="max_severity"
              stroke="var(--color-alert)"
              strokeWidth={2}
              dot={lineDotSkipZeroHeadacheDays(compact, "var(--color-alert)")}
              name="Max Severity"
            />

            {hasHrvChart && (
              <Line
                yAxisId="hrvRmssd"
                type="monotone"
                dataKey="hrv_rmssd_ms"
                stroke="#c084fc"
                strokeWidth={2}
                dot={{ r: compact ? 2 : 3, fill: "#c084fc" }}
                connectNulls={false}
                name="HRV (ms)"
              />
            )}

            {/* Aura indicators on individual bars - only show when bars are visible */}
            {showIndividualBars && barData
              .filter((entry) => entry.aura)
              .map((entry) => (
                <ReferenceDot
                  key={`aura-${entry.id}`}
                  yAxisId="severity"
                  x={entry.displayDate}
                  y={entry.severity}
                  r={compact ? 4 : 6}
                  fill="var(--color-alert)"
                  stroke="var(--color-bg)"
                  strokeWidth={1}
                />
              ))}

            {/* Other (non-medication) events — medication shown as blue bars */}
            {chartData.map((entry, index) =>
              entry.events.some((e) => !isMedicationEvent(e)) ? (
                <ReferenceDot
                  key={`events-${index}`}
                  yAxisId="severity"
                  x={entry.displayDate}
                  y={-0.5}
                  r={compact ? 3 : 4}
                  fill="var(--color-neon-lime)"
                  stroke="var(--color-bg)"
                  strokeWidth={1}
                />
              ) : null,
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {!compact && (
        <div className="mt-4 text-xs text-[--color-subtle] space-y-1">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-sm"
                style={{ background: "#3b82f6" }}
              />
              <span>Medication (bars, right scale)</span>
            </div>
            {hasHrvChart && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#c084fc]" />
                <span>HRV (right scale)</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
