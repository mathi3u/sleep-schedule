"use client";

import { useState, useEffect } from "react";
import {
  getAwakeWindowRange,
  getSuggestedNaps,
} from "@/lib/schedule";

interface ScheduleItem {
  minutes: number; // minutes since midnight
  label: string;
  type: "wake" | "nap" | "bedtime";
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

function getAwakeWindow(ageMonths: number): number {
  if (ageMonths < 3) return 52; // avg of 45-60
  if (ageMonths < 6) return 120; // avg of 90-150
  if (ageMonths < 9) return 150; // avg of 120-180
  return 210; // avg of 180-240
}

function getNapDuration(ageMonths: number, napNumber: number, totalNaps: number): number {
  const isLastNap = napNumber === totalNaps;
  if (ageMonths < 3) return isLastNap ? 30 : 45;
  if (ageMonths < 6) return isLastNap ? 30 : 60;
  if (ageMonths < 9) return isLastNap ? 30 : 75;
  return isLastNap ? 30 : 90;
}

function generateInitialSchedule(ageMonths: number, numNaps: number, wakeTimeMinutes: number): ScheduleItem[] {
  const schedule: ScheduleItem[] = [];
  const awakeWindow = getAwakeWindow(ageMonths);
  let currentTime = wakeTimeMinutes;

  schedule.push({ minutes: currentTime, label: "Wake up", type: "wake" });

  for (let i = 1; i <= numNaps; i++) {
    currentTime += awakeWindow;
    const napLabel = numNaps === 1 ? "Nap" : `Nap ${i}`;
    schedule.push({ minutes: currentTime, label: napLabel, type: "nap" });
    currentTime += getNapDuration(ageMonths, i, numNaps);
  }

  currentTime += awakeWindow;
  schedule.push({ minutes: currentTime, label: "Bedtime", type: "bedtime" });

  return schedule;
}

export default function Home() {
  const [ageMonths, setAgeMonths] = useState(4);
  const [numNaps, setNumNaps] = useState(3);
  const [wakeTime, setWakeTime] = useState("06:30");
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);

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
  };

  const handleTimeChange = (index: number, newMinutes: number) => {
    setSchedule((prev) => {
      const updated = [...prev];
      const delta = newMinutes - updated[index].minutes;

      // Shift this item and everything after it
      return updated.map((item, i) => ({
        ...item,
        minutes: i >= index ? item.minutes + delta : item.minutes,
      }));
    });
  };

  // Slider range: 5am to 10pm (300 to 1320 minutes)
  const sliderMin = 300;
  const sliderMax = 1320;

  return (
    <div className="min-h-screen bg-stone-50 py-12 px-4">
      <main className="max-w-md mx-auto">
        <h1 className="text-2xl font-semibold text-stone-800 mb-2">
          Sleep Schedule
        </h1>
        <p className="text-stone-500 mb-8">
          Get a recommended daily schedule for your baby
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
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-4 py-3 bg-stone-100 border-b border-stone-200">
                <h2 className="font-medium text-stone-700">Your Schedule</h2>
                <p className="text-sm text-stone-400">
                  Drag sliders to adjust times
                </p>
              </div>
              <div className="divide-y divide-stone-100">
                {schedule.map((event, index) => (
                  <div key={index} className="px-4 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            event.type === "wake"
                              ? "bg-amber-400"
                              : event.type === "nap"
                              ? "bg-indigo-400"
                              : "bg-slate-600"
                          }`}
                        />
                        <span className="text-stone-700">{event.label}</span>
                      </div>
                      <span className="text-stone-800 font-mono font-medium">
                        {formatTime(event.minutes)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={sliderMin}
                      max={sliderMax}
                      step={5}
                      value={Math.max(sliderMin, Math.min(sliderMax, event.minutes))}
                      onChange={(e) => handleTimeChange(index, Number(e.target.value))}
                      className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
                        event.type === "wake"
                          ? "bg-amber-100 accent-amber-500"
                          : event.type === "nap"
                          ? "bg-indigo-100 accent-indigo-500"
                          : "bg-slate-200 accent-slate-600"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                Sliding any time shifts everything after it. Move wake time to shift
                the whole day.
              </p>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-3 px-4 bg-white text-stone-700 rounded-lg font-medium border border-stone-200 hover:bg-stone-50 transition-colors"
            >
              Start Over
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
