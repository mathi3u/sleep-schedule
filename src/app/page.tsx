"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface NapBlock {
  startMinutes: number;
  endMinutes: number;
}

interface Schedule {
  wakeTime: number;
  bedtime: number;
  naps: NapBlock[];
}

function formatTime24(minutes: number): string {
  const hours = Math.floor(((minutes % 1440) + 1440) % 1440 / 60);
  const mins = ((minutes % 60) + 60) % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function minutesToAngle(minutes: number): number {
  return ((minutes / (24 * 60)) * 360) % 360;
}

function angleToMinutes(angle: number): number {
  const normalized = ((angle % 360) + 360) % 360;
  return Math.round((normalized / 360) * 24 * 60);
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
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

function getAwakeWindow(ageMonths: number): number {
  if (ageMonths < 3) return 52;
  if (ageMonths < 6) return 120;
  if (ageMonths < 9) return 150;
  return 210;
}

function getNapDuration(ageMonths: number, napNumber: number, totalNaps: number): number {
  const isLastNap = napNumber === totalNaps;
  if (ageMonths < 3) return isLastNap ? 30 : 45;
  if (ageMonths < 6) return isLastNap ? 30 : 60;
  if (ageMonths < 9) return isLastNap ? 30 : 75;
  return isLastNap ? 30 : 90;
}

function getSuggestedNaps(ageMonths: number): number {
  if (ageMonths < 3) return 4;
  if (ageMonths < 6) return 3;
  if (ageMonths < 9) return 3;
  return 2;
}

function generateSchedule(ageMonths: number, numNaps: number, wakeTime: number): Schedule {
  const awakeWindow = getAwakeWindow(ageMonths);
  const naps: NapBlock[] = [];
  let currentTime = wakeTime;

  for (let i = 1; i <= numNaps; i++) {
    currentTime += awakeWindow;
    const napStart = currentTime;
    const napDuration = getNapDuration(ageMonths, i, numNaps);
    currentTime += napDuration;
    naps.push({ startMinutes: napStart, endMinutes: currentTime });
  }

  currentTime += awakeWindow;

  return {
    wakeTime,
    bedtime: Math.min(currentTime, 22 * 60), // Cap at 10pm
    naps,
  };
}

export default function Home() {
  const [ageMonths, setAgeMonths] = useState(6);
  const [numNaps, setNumNaps] = useState(3);
  const [schedule, setSchedule] = useState<Schedule>(() =>
    generateSchedule(6, 3, 6 * 60 + 30)
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ type: string; index?: number } | null>(null);

  const cx = 160;
  const cy = 160;
  const radius = 130;
  const arcWidth = 20;
  const handleRadius = 10;

  // Regenerate schedule when age/naps change
  useEffect(() => {
    setSchedule(generateSchedule(ageMonths, numNaps, schedule.wakeTime));
  }, [ageMonths, numNaps]);

  const getNightSleep = () => {
    let duration = schedule.wakeTime - schedule.bedtime;
    if (duration < 0) duration += 24 * 60;
    return duration;
  };

  const getTotalDaytimeSleep = () => {
    return schedule.naps.reduce((sum, nap) => sum + (nap.endMinutes - nap.startMinutes), 0);
  };

  const nightSleep = getNightSleep();
  const daytimeSleep = getTotalDaytimeSleep();

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top - cy;

    let angle = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;

    const minutes = Math.round(angleToMinutes(angle) / 5) * 5;

    setSchedule((prev) => {
      const updated = { ...prev, naps: [...prev.naps] };

      if (dragging.type === "wake") {
        const delta = minutes - updated.wakeTime;
        updated.wakeTime = minutes;
        // Shift all naps
        updated.naps = updated.naps.map((nap) => ({
          startMinutes: nap.startMinutes + delta,
          endMinutes: nap.endMinutes + delta,
        }));
        updated.bedtime += delta;
      } else if (dragging.type === "bedtime") {
        const lastNap = updated.naps[updated.naps.length - 1];
        const minBedtime = lastNap ? lastNap.endMinutes + 30 : updated.wakeTime + 60;
        updated.bedtime = Math.max(minBedtime, minutes);
      } else if (dragging.type === "napStart" && dragging.index !== undefined) {
        const nap = updated.naps[dragging.index];
        const minStart = dragging.index === 0
          ? updated.wakeTime + 30
          : updated.naps[dragging.index - 1].endMinutes + 30;
        const maxStart = nap.endMinutes - 15;
        updated.naps[dragging.index] = {
          ...nap,
          startMinutes: Math.max(minStart, Math.min(maxStart, minutes)),
        };
      } else if (dragging.type === "napEnd" && dragging.index !== undefined) {
        const nap = updated.naps[dragging.index];
        const minEnd = nap.startMinutes + 15;
        const maxEnd = dragging.index < updated.naps.length - 1
          ? updated.naps[dragging.index + 1].startMinutes - 30
          : updated.bedtime - 30;
        updated.naps[dragging.index] = {
          ...nap,
          endMinutes: Math.max(minEnd, Math.min(maxEnd, minutes)),
        };
      }

      return updated;
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

  const bedtimeIdeal = schedule.bedtime >= 19 * 60 && schedule.bedtime <= 20 * 60;
  const wakeIdeal = schedule.wakeTime >= 6 * 60 && schedule.wakeTime <= 7 * 60;
  const sleepIdeal = nightSleep >= 10 * 60 && nightSleep <= 12 * 60;

  return (
    <div className="min-h-screen bg-[#1c1c1e] py-6 px-4">
      <main className="max-w-sm mx-auto">
        <h1 className="text-xl font-semibold text-white text-center mb-4">Sleep Schedule</h1>

        {/* Age & Naps selector */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-[#2c2c2e] rounded-xl p-3">
            <label className="text-gray-400 text-xs block mb-1">Age (months)</label>
            <select
              value={ageMonths}
              onChange={(e) => {
                const age = Number(e.target.value);
                setAgeMonths(age);
                setNumNaps(getSuggestedNaps(age));
              }}
              className="w-full bg-transparent text-white text-lg font-light focus:outline-none"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i + 1} className="bg-[#2c2c2e]">
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 bg-[#2c2c2e] rounded-xl p-3">
            <label className="text-gray-400 text-xs block mb-1">Naps</label>
            <select
              value={numNaps}
              onChange={(e) => setNumNaps(Number(e.target.value))}
              className="w-full bg-transparent text-white text-lg font-light focus:outline-none"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n} className="bg-[#2c2c2e]">
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Time Display */}
        <div className="flex justify-between px-4 mb-2">
          <div className="text-center">
            <div className="text-gray-400 text-xs mb-1">🛏️ BEDTIME</div>
            <div className="text-white text-xl font-light">{formatTime24(schedule.bedtime)}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-400 text-xs mb-1">⏰ WAKE UP</div>
            <div className="text-white text-xl font-light">{formatTime24(schedule.wakeTime)}</div>
          </div>
        </div>

        {/* Circular Clock */}
        <div className="flex justify-center mb-2">
          <svg
            ref={svgRef}
            width="320"
            height="320"
            className="select-none"
            style={{ touchAction: "none" }}
          >
            {/* Background circle */}
            <circle cx={cx} cy={cy} r={radius + 12} fill="#2c2c2e" stroke="#3a3a3c" strokeWidth="1" />

            {/* Hour markers */}
            {Array.from({ length: 24 }, (_, i) => {
              const angle = (i / 24) * 360;
              const innerR = radius + 2;
              const outerR = i % 2 === 0 ? radius + 10 : radius + 6;
              const start = polarToCartesian(cx, cy, innerR, angle);
              const end = polarToCartesian(cx, cy, outerR, angle);
              return (
                <line key={i} x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                  stroke="#5a5a5c" strokeWidth={i % 2 === 0 ? 2 : 1} />
              );
            })}

            {/* Hour labels */}
            {[0, 4, 8, 12, 16, 20].map((hour) => {
              const angle = (hour / 24) * 360;
              const pos = polarToCartesian(cx, cy, radius - 18, angle);
              return (
                <text key={hour} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle"
                  fill="#8e8e93" fontSize="11" fontWeight="300">
                  {hour}
                </text>
              );
            })}

            {/* Inner circle */}
            <circle cx={cx} cy={cy} r={radius - 32} fill="#1c1c1e" stroke="#3a3a3c" strokeWidth="1" />

            {/* Center icons */}
            <text x={cx} y={cy - 45} textAnchor="middle" fontSize="16">🌙</text>
            <text x={cx} y={cy + 45} textAnchor="middle" fontSize="16">☀️</text>

            {/* Night sleep arc (orange) */}
            <path
              d={describeArc(cx, cy, radius - 10, minutesToAngle(schedule.bedtime), minutesToAngle(schedule.wakeTime))}
              fill="none" stroke="#f5a623" strokeWidth={arcWidth} strokeLinecap="round"
            />

            {/* Nap arcs (indigo) */}
            {schedule.naps.map((nap, index) => {
              const startAngle = minutesToAngle(nap.startMinutes);
              const endAngle = minutesToAngle(nap.endMinutes);
              const startPos = polarToCartesian(cx, cy, radius - 10, startAngle);
              const endPos = polarToCartesian(cx, cy, radius - 10, endAngle);
              const midAngle = (startAngle + endAngle) / 2;
              const midPos = polarToCartesian(cx, cy, radius - 10, midAngle);

              return (
                <g key={index}>
                  {/* Nap arc */}
                  <path
                    d={describeArc(cx, cy, radius - 10, startAngle, endAngle)}
                    fill="none" stroke="#8b5cf6" strokeWidth={arcWidth} strokeLinecap="round"
                  />

                  {/* Nap duration label */}
                  <text x={midPos.x} y={midPos.y} textAnchor="middle" dominantBaseline="middle"
                    fill="white" fontSize="9" fontWeight="500">
                    {formatDuration(nap.endMinutes - nap.startMinutes)}
                  </text>

                  {/* Start handle */}
                  <circle cx={startPos.x} cy={startPos.y} r={handleRadius}
                    fill="#8b5cf6" stroke="#1c1c1e" strokeWidth="2"
                    className="cursor-grab" onMouseDown={() => setDragging({ type: "napStart", index })} />

                  {/* End handle */}
                  <circle cx={endPos.x} cy={endPos.y} r={handleRadius}
                    fill="#8b5cf6" stroke="#1c1c1e" strokeWidth="2"
                    className="cursor-grab" onMouseDown={() => setDragging({ type: "napEnd", index })} />
                </g>
              );
            })}

            {/* Bedtime handle */}
            {(() => {
              const pos = polarToCartesian(cx, cy, radius - 10, minutesToAngle(schedule.bedtime));
              return (
                <g>
                  <circle cx={pos.x} cy={pos.y} r={handleRadius + 2}
                    fill="#f5a623" stroke="#1c1c1e" strokeWidth="2"
                    className="cursor-grab" onMouseDown={() => setDragging({ type: "bedtime" })} />
                  <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle" fontSize="8">🛏️</text>
                </g>
              );
            })()}

            {/* Wake handle */}
            {(() => {
              const pos = polarToCartesian(cx, cy, radius - 10, minutesToAngle(schedule.wakeTime));
              return (
                <g>
                  <circle cx={pos.x} cy={pos.y} r={handleRadius + 2}
                    fill="#f5a623" stroke="#1c1c1e" strokeWidth="2"
                    className="cursor-grab" onMouseDown={() => setDragging({ type: "wake" })} />
                  <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle" fontSize="8">⏰</text>
                </g>
              );
            })()}
          </svg>
        </div>

        {/* Duration Display */}
        <div className="text-center mb-4">
          <div className="text-white text-xl font-semibold">{formatDuration(nightSleep)} night</div>
          <div className="text-purple-400 text-sm">{formatDuration(daytimeSleep)} daytime naps</div>
          <div className={`text-xs mt-1 ${sleepIdeal ? 'text-green-500' : 'text-gray-500'}`}>
            {sleepIdeal ? "✓ Meets sleep goal" : "Aim for 10-12h night sleep"}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-[#2c2c2e] rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#f5a623]"></div>
            <span className="text-gray-400 text-sm flex-1">Night sleep</span>
            <span className={`text-xs ${bedtimeIdeal && wakeIdeal ? 'text-green-500' : 'text-amber-500'}`}>
              {bedtimeIdeal && wakeIdeal ? '✓ ideal times' : '7-8pm → 6-7am'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#8b5cf6]"></div>
            <span className="text-gray-400 text-sm flex-1">Daytime naps</span>
            <span className="text-gray-500 text-xs">Drag to adjust</span>
          </div>
        </div>
      </main>
    </div>
  );
}
