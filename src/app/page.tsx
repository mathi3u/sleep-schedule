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

function formatTime(minutes: number): string {
  const hours = Math.floor(((minutes % 1440) + 1440) % 1440 / 60);
  const mins = ((minutes % 60) + 60) % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`;
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
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
    bedtime: Math.min(currentTime, 22 * 60),
    naps,
  };
}

export default function Home() {
  const [ageMonths, setAgeMonths] = useState(6);
  const [numNaps, setNumNaps] = useState(3);
  const [schedule, setSchedule] = useState<Schedule>(() =>
    generateSchedule(6, 3, 6 * 60 + 30)
  );

  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ type: string; index?: number } | null>(null);

  useEffect(() => {
    setSchedule(generateSchedule(ageMonths, numNaps, schedule.wakeTime));
  }, [ageMonths, numNaps]);

  // Timeline: 5am to 10pm
  const timelineStart = 5 * 60;
  const timelineEnd = 22 * 60;
  const timelineRange = timelineEnd - timelineStart;

  const minutesToPercent = (minutes: number) => {
    return ((minutes - timelineStart) / timelineRange) * 100;
  };

  const percentToMinutes = (percent: number) => {
    return Math.round((percent / 100) * timelineRange + timelineStart);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    const minutes = Math.round(percentToMinutes(percent) / 5) * 5;

    setSchedule((prev) => {
      const updated = { ...prev, naps: [...prev.naps] };

      if (dragging.type === "wake") {
        const delta = minutes - updated.wakeTime;
        updated.wakeTime = minutes;
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

  const getNightSleep = () => {
    let duration = schedule.wakeTime - schedule.bedtime;
    if (duration < 0) duration += 24 * 60;
    return duration;
  };

  const getTotalDaytimeSleep = () => {
    return schedule.naps.reduce((sum, nap) => sum + (nap.endMinutes - nap.startMinutes), 0);
  };

  const getAwakeWindows = () => {
    const windows: { start: number; end: number }[] = [];

    if (schedule.naps.length > 0) {
      windows.push({ start: schedule.wakeTime, end: schedule.naps[0].startMinutes });

      for (let i = 0; i < schedule.naps.length - 1; i++) {
        windows.push({ start: schedule.naps[i].endMinutes, end: schedule.naps[i + 1].startMinutes });
      }

      windows.push({ start: schedule.naps[schedule.naps.length - 1].endMinutes, end: schedule.bedtime });
    }

    return windows;
  };

  const nightSleep = getNightSleep();
  const daytimeSleep = getTotalDaytimeSleep();
  const awakeWindows = getAwakeWindows();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4">
        <h1 className="text-lg font-semibold text-slate-800 text-center">Sleep Schedule</h1>

        {/* Controls */}
        <div className="flex gap-4 mt-3 max-w-md mx-auto">
          <div className="flex-1">
            <label className="text-xs text-slate-500 block mb-1">Age (months)</label>
            <select
              value={ageMonths}
              onChange={(e) => {
                const age = Number(e.target.value);
                setAgeMonths(age);
                setNumNaps(getSuggestedNaps(age));
              }}
              className="w-full px-3 py-2 bg-slate-100 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500 block mb-1">Naps</label>
            <select
              value={numNaps}
              onChange={(e) => setNumNaps(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-100 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Timeline */}
      <div
        ref={timelineRef}
        className="relative"
        style={{
          height: 'calc(100vh - 180px)',
          cursor: dragging ? 'ns-resize' : 'default'
        }}
      >
        {/* Time markers */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-white border-r border-slate-200 z-10">
          {[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map((hour) => {
            const percent = minutesToPercent(hour * 60);
            return (
              <div
                key={hour}
                className="absolute left-0 right-0 text-xs text-slate-400 text-right pr-2"
                style={{ top: `${percent}%`, transform: 'translateY(-50%)' }}
              >
                {hour > 12 ? hour - 12 : hour}{hour >= 12 ? 'p' : 'a'}
              </div>
            );
          })}
        </div>

        {/* Main timeline area */}
        <div className="absolute left-12 right-0 top-0 bottom-0">
          {/* Awake windows (cream/beige) */}
          {awakeWindows.map((window, i) => (
            <div
              key={`awake-${i}`}
              className="absolute left-0 right-0 bg-amber-50 flex items-center justify-center"
              style={{
                top: `${minutesToPercent(window.start)}%`,
                height: `${minutesToPercent(window.end) - minutesToPercent(window.start)}%`,
              }}
            >
              <span className="text-amber-600 text-sm font-medium">
                {formatDuration(window.end - window.start)} awake
              </span>
            </div>
          ))}

          {/* Wake marker */}
          <div
            className="absolute left-0 right-0 h-12 bg-yellow-100 border-y-2 border-yellow-300 flex items-center justify-between px-4 cursor-ns-resize z-20"
            style={{ top: `${minutesToPercent(schedule.wakeTime)}%`, transform: 'translateY(-50%)' }}
            onMouseDown={() => setDragging({ type: "wake" })}
          >
            <span className="text-yellow-700 font-medium">☀️ Wake up</span>
            <span className="text-yellow-700 font-semibold">{formatTime(schedule.wakeTime)}</span>
          </div>

          {/* Nap blocks */}
          {schedule.naps.map((nap, index) => {
            const topPercent = minutesToPercent(nap.startMinutes);
            const heightPercent = minutesToPercent(nap.endMinutes) - topPercent;
            const duration = nap.endMinutes - nap.startMinutes;

            return (
              <div
                key={index}
                className="absolute left-0 right-0 bg-indigo-100 z-10"
                style={{
                  top: `${topPercent}%`,
                  height: `${heightPercent}%`,
                }}
              >
                {/* Top drag handle */}
                <div
                  className="absolute top-0 left-0 right-0 h-6 bg-indigo-200 cursor-ns-resize flex items-center justify-between px-4"
                  onMouseDown={() => setDragging({ type: "napStart", index })}
                >
                  <span className="text-indigo-600 text-sm">Nap {index + 1} start</span>
                  <span className="text-indigo-600 text-sm font-medium">{formatTime(nap.startMinutes)}</span>
                </div>

                {/* Nap content */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl mb-1">🌙</div>
                    <div className="text-indigo-600 font-semibold">{formatDuration(duration)}</div>
                  </div>
                </div>

                {/* Bottom drag handle */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-6 bg-indigo-200 cursor-ns-resize flex items-center justify-between px-4"
                  onMouseDown={() => setDragging({ type: "napEnd", index })}
                >
                  <span className="text-indigo-600 text-sm">Nap {index + 1} end</span>
                  <span className="text-indigo-600 text-sm font-medium">{formatTime(nap.endMinutes)}</span>
                </div>
              </div>
            );
          })}

          {/* Bedtime marker */}
          <div
            className="absolute left-0 right-0 h-12 bg-slate-200 border-y-2 border-slate-400 flex items-center justify-between px-4 cursor-ns-resize z-20"
            style={{ top: `${minutesToPercent(schedule.bedtime)}%`, transform: 'translateY(-50%)' }}
            onMouseDown={() => setDragging({ type: "bedtime" })}
          >
            <span className="text-slate-700 font-medium">🌙 Bedtime</span>
            <span className="text-slate-700 font-semibold">{formatTime(schedule.bedtime)}</span>
          </div>
        </div>
      </div>

      {/* Footer summary */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3">
        <div className="flex justify-around max-w-md mx-auto text-center">
          <div>
            <div className="text-lg font-semibold text-slate-800">{formatDuration(nightSleep)}</div>
            <div className="text-xs text-slate-500">Night sleep</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-indigo-600">{formatDuration(daytimeSleep)}</div>
            <div className="text-xs text-slate-500">Daytime naps</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-amber-600">{schedule.naps.length}</div>
            <div className="text-xs text-slate-500">Naps</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
