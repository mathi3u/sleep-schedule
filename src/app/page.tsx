"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Schedule {
  wakeTime: number; // minutes since midnight
  bedtime: number;  // minutes since midnight
}

function formatTime24(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

// Convert minutes to angle (0° at top, clockwise)
function minutesToAngle(minutes: number): number {
  return ((minutes / (24 * 60)) * 360) % 360;
}

// Convert angle to minutes
function angleToMinutes(angle: number): number {
  const normalized = ((angle % 360) + 360) % 360;
  return Math.round((normalized / 360) * 24 * 60);
}

// Calculate arc path for SVG
function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);

  // Handle the arc going through midnight
  let arcSweep = endAngle - startAngle;
  if (arcSweep < 0) arcSweep += 360;
  const largeArcFlag = arcSweep > 180 ? 1 : 0;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

export default function Home() {
  const [schedule, setSchedule] = useState<Schedule>({
    bedtime: 19 * 60 + 30, // 7:30 PM
    wakeTime: 6 * 60,      // 6:00 AM
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<"bedtime" | "wake" | null>(null);

  const cx = 150; // center x
  const cy = 150; // center y
  const radius = 120; // main radius
  const handleRadius = 12;

  // Calculate night sleep duration
  const getNightSleep = () => {
    let duration = schedule.wakeTime - schedule.bedtime;
    if (duration < 0) duration += 24 * 60; // crosses midnight
    return duration;
  };

  const nightSleep = getNightSleep();
  const bedtimeAngle = minutesToAngle(schedule.bedtime);
  const wakeAngle = minutesToAngle(schedule.wakeTime);

  const bedtimePos = polarToCartesian(cx, cy, radius, bedtimeAngle);
  const wakePos = polarToCartesian(cx, cy, radius, wakeAngle);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top - cy;

    let angle = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;

    // Snap to 5-minute intervals
    const minutes = Math.round(angleToMinutes(angle) / 5) * 5;

    setSchedule((prev) => {
      if (dragging === "bedtime") {
        return { ...prev, bedtime: minutes };
      } else {
        return { ...prev, wakeTime: minutes };
      }
    });
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  // Check if times are in ideal ranges
  const bedtimeIdeal = schedule.bedtime >= 19 * 60 && schedule.bedtime <= 20 * 60;
  const wakeIdeal = schedule.wakeTime >= 6 * 60 && schedule.wakeTime <= 7 * 60;
  const sleepIdeal = nightSleep >= 10 * 60 && nightSleep <= 12 * 60;

  return (
    <div className="min-h-screen bg-[#1c1c1e] py-8 px-4">
      <main className="max-w-sm mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-white">Sleep Schedule</h1>
        </div>

        {/* Time Display */}
        <div className="flex justify-between px-8 mb-4">
          <div className="text-center">
            <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
              <span>🛏️</span>
              <span>BEDTIME</span>
            </div>
            <div className="text-white text-2xl font-light">{formatTime24(schedule.bedtime)}</div>
            <div className="text-gray-500 text-xs">Tonight</div>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
              <span>⏰</span>
              <span>WAKE UP</span>
            </div>
            <div className="text-white text-2xl font-light">{formatTime24(schedule.wakeTime)}</div>
            <div className="text-gray-500 text-xs">Tomorrow</div>
          </div>
        </div>

        {/* Circular Clock */}
        <div className="flex justify-center mb-4">
          <svg
            ref={svgRef}
            width="300"
            height="300"
            className="select-none"
            style={{ touchAction: "none" }}
          >
            {/* Background circle */}
            <circle
              cx={cx}
              cy={cy}
              r={radius + 15}
              fill="#2c2c2e"
              stroke="#3a3a3c"
              strokeWidth="1"
            />

            {/* Hour markers */}
            {Array.from({ length: 24 }, (_, i) => {
              const angle = (i / 24) * 360;
              const innerR = radius + 5;
              const outerR = i % 2 === 0 ? radius + 12 : radius + 8;
              const start = polarToCartesian(cx, cy, innerR, angle);
              const end = polarToCartesian(cx, cy, outerR, angle);
              return (
                <line
                  key={i}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#5a5a5c"
                  strokeWidth={i % 2 === 0 ? 2 : 1}
                />
              );
            })}

            {/* Hour labels */}
            {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].map((hour) => {
              const angle = (hour / 24) * 360;
              const pos = polarToCartesian(cx, cy, radius - 20, angle);
              return (
                <text
                  key={hour}
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#8e8e93"
                  fontSize="12"
                  fontWeight="300"
                >
                  {hour}
                </text>
              );
            })}

            {/* Inner circle */}
            <circle
              cx={cx}
              cy={cy}
              r={radius - 35}
              fill="#1c1c1e"
              stroke="#3a3a3c"
              strokeWidth="1"
            />

            {/* Moon at top (midnight) */}
            <text
              x={cx}
              y={cy - 55}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="20"
            >
              🌙
            </text>

            {/* Sun at bottom (noon) */}
            <text
              x={cx}
              y={cy + 55}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="20"
            >
              ☀️
            </text>

            {/* Sleep arc */}
            <path
              d={describeArc(cx, cy, radius, bedtimeAngle, wakeAngle)}
              fill="none"
              stroke="#f5a623"
              strokeWidth="24"
              strokeLinecap="round"
            />

            {/* Bedtime handle */}
            <circle
              cx={bedtimePos.x}
              cy={bedtimePos.y}
              r={handleRadius}
              fill="#f5a623"
              stroke="#1c1c1e"
              strokeWidth="3"
              className="cursor-grab active:cursor-grabbing"
              onMouseDown={() => setDragging("bedtime")}
            />
            <text
              x={bedtimePos.x}
              y={bedtimePos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
            >
              🛏️
            </text>

            {/* Wake handle */}
            <circle
              cx={wakePos.x}
              cy={wakePos.y}
              r={handleRadius}
              fill="#f5a623"
              stroke="#1c1c1e"
              strokeWidth="3"
              className="cursor-grab active:cursor-grabbing"
              onMouseDown={() => setDragging("wake")}
            />
            <text
              x={wakePos.x}
              y={wakePos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
            >
              ⏰
            </text>
          </svg>
        </div>

        {/* Duration Display */}
        <div className="text-center mb-6">
          <div className="text-white text-2xl font-semibold">{formatDuration(nightSleep)}</div>
          <div className={`text-sm ${sleepIdeal ? 'text-green-500' : 'text-gray-400'}`}>
            {sleepIdeal
              ? "This schedule meets the sleep goal"
              : "Aim for 10-12 hours of night sleep"}
          </div>
        </div>

        {/* Status indicators */}
        <div className="bg-[#2c2c2e] rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Bedtime</span>
            <span className={`text-sm ${bedtimeIdeal ? 'text-green-500' : 'text-amber-500'}`}>
              {bedtimeIdeal ? '✓ 7-8 PM ideal' : 'Aim for 7-8 PM'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Wake time</span>
            <span className={`text-sm ${wakeIdeal ? 'text-green-500' : 'text-amber-500'}`}>
              {wakeIdeal ? '✓ 6-7 AM ideal' : 'Aim for 6-7 AM'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Night sleep</span>
            <span className={`text-sm ${sleepIdeal ? 'text-green-500' : 'text-amber-500'}`}>
              {sleepIdeal ? '✓ 10-12h goal' : 'Aim for 10-12h'}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
