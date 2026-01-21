"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getAwakeWindowRange, getSuggestedNaps } from "@/lib/schedule";

interface NapBlock {
  startMinutes: number;
  endMinutes: number;
}

interface Schedule {
  wakeTime: number;
  naps: NapBlock[];
  bedtime: number;
}

function parseTime(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function formatTime(minutes: number): string {
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
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

function generateInitialSchedule(ageMonths: number, numNaps: number, wakeTimeMinutes: number): Schedule {
  const awakeWindow = getAwakeWindow(ageMonths);
  const naps: NapBlock[] = [];
  let currentTime = wakeTimeMinutes;

  for (let i = 1; i <= numNaps; i++) {
    currentTime += awakeWindow;
    const napStart = currentTime;
    const napDuration = getNapDuration(ageMonths, i, numNaps);
    currentTime += napDuration;
    naps.push({ startMinutes: napStart, endMinutes: currentTime });
  }

  currentTime += awakeWindow;

  return {
    wakeTime: wakeTimeMinutes,
    naps,
    bedtime: currentTime,
  };
}

export default function Home() {
  const [ageMonths, setAgeMonths] = useState(4);
  const [numNaps, setNumNaps] = useState(3);
  const [wakeTime, setWakeTime] = useState("06:30");
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);

  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ type: string; index?: number } | null>(null);

  useEffect(() => {
    setNumNaps(getSuggestedNaps(ageMonths));
  }, [ageMonths]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = generateInitialSchedule(ageMonths, numNaps, parseTime(wakeTime));
    setSchedule(result);
    setShowSchedule(true);
  };

  const handleReset = () => {
    setShowSchedule(false);
    setSchedule(null);
  };

  // Timeline range based on schedule
  const timelineStart = schedule ? Math.min(schedule.wakeTime - 30, 300) : 300; // 30min before wake or 5am
  const timelineEnd = schedule ? Math.max(schedule.bedtime + 30, 1380) : 1380; // 30min after bed or 11pm
  const timelineRange = timelineEnd - timelineStart;

  const minutesToPercent = useCallback((minutes: number) => {
    return ((minutes - timelineStart) / timelineRange) * 100;
  }, [timelineStart, timelineRange]);

  const percentToMinutes = useCallback((percent: number) => {
    return Math.round((percent / 100) * timelineRange + timelineStart);
  }, [timelineStart, timelineRange]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !timelineRef.current || !schedule) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    const minutes = Math.round(percentToMinutes(percent) / 5) * 5; // snap to 5min

    setSchedule((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, naps: [...prev.naps] };

      if (dragging.type === "wake") {
        const delta = minutes - updated.wakeTime;
        updated.wakeTime = minutes;
        // Shift all naps and bedtime
        updated.naps = updated.naps.map((nap) => ({
          startMinutes: nap.startMinutes + delta,
          endMinutes: nap.endMinutes + delta,
        }));
        updated.bedtime += delta;
      } else if (dragging.type === "napStart" && dragging.index !== undefined) {
        const nap = updated.naps[dragging.index];
        const minStart = dragging.index === 0
          ? updated.wakeTime + 15
          : updated.naps[dragging.index - 1].endMinutes + 15;
        const maxStart = nap.endMinutes - 15;
        updated.naps[dragging.index] = {
          ...nap,
          startMinutes: Math.max(minStart, Math.min(maxStart, minutes)),
        };
      } else if (dragging.type === "napEnd" && dragging.index !== undefined) {
        const nap = updated.naps[dragging.index];
        const minEnd = nap.startMinutes + 15;
        const maxEnd = dragging.index < updated.naps.length - 1
          ? updated.naps[dragging.index + 1].startMinutes - 15
          : updated.bedtime - 15;
        updated.naps[dragging.index] = {
          ...nap,
          endMinutes: Math.max(minEnd, Math.min(maxEnd, minutes)),
        };
      } else if (dragging.type === "bedtime") {
        const lastNap = updated.naps[updated.naps.length - 1];
        const minBedtime = lastNap ? lastNap.endMinutes + 15 : updated.wakeTime + 60;
        updated.bedtime = Math.max(minBedtime, minutes);
      }

      return updated;
    });
  }, [dragging, schedule, percentToMinutes]);

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

  // Calculate awake windows
  const getAwakeWindows = () => {
    if (!schedule) return [];
    const windows: { startMinutes: number; endMinutes: number; duration: number }[] = [];

    // First awake window: wake to first nap
    if (schedule.naps.length > 0) {
      windows.push({
        startMinutes: schedule.wakeTime,
        endMinutes: schedule.naps[0].startMinutes,
        duration: schedule.naps[0].startMinutes - schedule.wakeTime,
      });

      // Between naps
      for (let i = 0; i < schedule.naps.length - 1; i++) {
        windows.push({
          startMinutes: schedule.naps[i].endMinutes,
          endMinutes: schedule.naps[i + 1].startMinutes,
          duration: schedule.naps[i + 1].startMinutes - schedule.naps[i].endMinutes,
        });
      }

      // Last awake window: last nap to bedtime
      const lastNap = schedule.naps[schedule.naps.length - 1];
      windows.push({
        startMinutes: lastNap.endMinutes,
        endMinutes: schedule.bedtime,
        duration: schedule.bedtime - lastNap.endMinutes,
      });
    }

    return windows;
  };

  return (
    <div className="min-h-screen bg-stone-50 py-12 px-4">
      <main className="max-w-md mx-auto">
        <h1 className="text-2xl font-semibold text-stone-800 mb-2">
          Sleep Schedule
        </h1>
        <p className="text-stone-500 mb-8">
          Build your baby&apos;s daily schedule
        </p>

        {!showSchedule ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="age" className="block text-sm font-medium text-stone-700 mb-2">
                Baby&apos;s age (months)
              </label>
              <input
                type="number"
                id="age"
                min={0}
                max={24}
                value={ageMonths}
                onChange={(e) => setAgeMonths(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
              <p className="mt-1 text-sm text-stone-400">
                Awake window: {getAwakeWindowRange(ageMonths)}
              </p>
            </div>

            <div>
              <label htmlFor="naps" className="block text-sm font-medium text-stone-700 mb-2">
                Number of naps
              </label>
              <select
                id="naps"
                value={numNaps}
                onChange={(e) => setNumNaps(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} nap{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="wakeTime" className="block text-sm font-medium text-stone-700 mb-2">
                Typical wake up time
              </label>
              <input
                type="time"
                id="wakeTime"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-stone-800 text-white rounded-lg font-medium hover:bg-stone-700 transition-colors"
            >
              Generate Schedule
            </button>
          </form>
        ) : schedule ? (
          <div className="space-y-6">
            {/* Vertical Timeline */}
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-4 py-3 bg-stone-100 border-b border-stone-200">
                <h2 className="font-medium text-stone-700">Your Schedule</h2>
                <p className="text-sm text-stone-400">Drag edges to adjust times</p>
              </div>

              <div className="p-4">
                <div
                  ref={timelineRef}
                  className="relative h-[500px] bg-amber-50 rounded-lg border border-stone-200"
                  style={{ cursor: dragging ? "ns-resize" : "default" }}
                >
                  {/* Time markers on left */}
                  {[6, 8, 10, 12, 14, 16, 18, 20, 22].map((hour) => {
                    const minutes = hour * 60;
                    if (minutes < timelineStart || minutes > timelineEnd) return null;
                    return (
                      <div
                        key={hour}
                        className="absolute left-0 w-8 text-xs text-stone-400 -translate-y-1/2"
                        style={{ top: `${minutesToPercent(minutes)}%` }}
                      >
                        {hour > 12 ? hour - 12 : hour}{hour >= 12 ? "p" : "a"}
                      </div>
                    );
                  })}

                  {/* Timeline track */}
                  <div className="absolute left-10 right-4 top-0 bottom-0">
                    {/* Awake windows (background shows through) */}
                    {getAwakeWindows().map((window, i) => (
                      <div
                        key={`awake-${i}`}
                        className="absolute left-0 right-0 flex items-center justify-center"
                        style={{
                          top: `${minutesToPercent(window.startMinutes)}%`,
                          height: `${minutesToPercent(window.endMinutes) - minutesToPercent(window.startMinutes)}%`,
                        }}
                      >
                        <span className="text-xs text-amber-600 bg-amber-50 px-1 rounded">
                          {formatDuration(window.duration)} awake
                        </span>
                      </div>
                    ))}

                    {/* Wake marker */}
                    <div
                      className="absolute left-0 right-0 h-1 bg-amber-400 cursor-ns-resize rounded-full"
                      style={{ top: `${minutesToPercent(schedule.wakeTime)}%` }}
                      onMouseDown={() => setDragging({ type: "wake" })}
                    >
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full pl-2 whitespace-nowrap">
                        <span className="text-xs font-medium text-amber-700">
                          Wake {formatTime(schedule.wakeTime)}
                        </span>
                      </div>
                    </div>

                    {/* Nap blocks */}
                    {schedule.naps.map((nap, index) => {
                      const topPercent = minutesToPercent(nap.startMinutes);
                      const bottomPercent = minutesToPercent(nap.endMinutes);
                      const heightPercent = bottomPercent - topPercent;
                      const duration = nap.endMinutes - nap.startMinutes;

                      return (
                        <div
                          key={index}
                          className="absolute left-0 right-0 bg-indigo-400 rounded-lg"
                          style={{
                            top: `${topPercent}%`,
                            height: `${heightPercent}%`,
                          }}
                        >
                          {/* Top drag handle */}
                          <div
                            className="absolute top-0 left-0 right-0 h-3 cursor-ns-resize bg-indigo-500 rounded-t-lg hover:bg-indigo-600"
                            onMouseDown={() => setDragging({ type: "napStart", index })}
                          />

                          {/* Nap label */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center text-white">
                              <div className="text-sm font-medium">
                                Nap {index + 1}
                              </div>
                              <div className="text-xs opacity-80">
                                {formatDuration(duration)}
                              </div>
                            </div>
                          </div>

                          {/* Time labels */}
                          <div className="absolute -right-2 top-0 translate-x-full pl-2">
                            <span className="text-xs text-indigo-700">{formatTime(nap.startMinutes)}</span>
                          </div>
                          <div className="absolute -right-2 bottom-0 translate-x-full pl-2">
                            <span className="text-xs text-indigo-700">{formatTime(nap.endMinutes)}</span>
                          </div>

                          {/* Bottom drag handle */}
                          <div
                            className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize bg-indigo-500 rounded-b-lg hover:bg-indigo-600"
                            onMouseDown={() => setDragging({ type: "napEnd", index })}
                          />
                        </div>
                      );
                    })}

                    {/* Bedtime marker */}
                    <div
                      className="absolute left-0 right-0 h-1 bg-slate-600 cursor-ns-resize rounded-full"
                      style={{ top: `${minutesToPercent(schedule.bedtime)}%` }}
                      onMouseDown={() => setDragging({ type: "bedtime" })}
                    >
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full pl-2 whitespace-nowrap">
                        <span className="text-xs font-medium text-slate-700">
                          Bed {formatTime(schedule.bedtime)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-3 px-4 bg-white text-stone-700 rounded-lg font-medium border border-stone-200 hover:bg-stone-50 transition-colors"
            >
              Start Over
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
