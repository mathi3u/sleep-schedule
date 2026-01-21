"use client";

import { useState, useEffect } from "react";
import {
  generateSchedule,
  getAwakeWindowRange,
  getSuggestedNaps,
  ScheduleEvent,
} from "@/lib/schedule";

export default function Home() {
  const [ageMonths, setAgeMonths] = useState(4);
  const [numNaps, setNumNaps] = useState(3);
  const [wakeTime, setWakeTime] = useState("06:30");
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);

  // Update suggested naps when age changes
  useEffect(() => {
    setNumNaps(getSuggestedNaps(ageMonths));
  }, [ageMonths]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = generateSchedule({ ageMonths, numNaps, wakeTime });
    setSchedule(result);
    setShowSchedule(true);
  };

  const handleReset = () => {
    setShowSchedule(false);
  };

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
            {/* Age Input */}
            <div>
              <label
                htmlFor="age"
                className="block text-sm font-medium text-stone-700 mb-2"
              >
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

            {/* Number of Naps */}
            <div>
              <label
                htmlFor="naps"
                className="block text-sm font-medium text-stone-700 mb-2"
              >
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

            {/* Wake Time */}
            <div>
              <label
                htmlFor="wakeTime"
                className="block text-sm font-medium text-stone-700 mb-2"
              >
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
            {/* Schedule Display */}
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-4 py-3 bg-stone-100 border-b border-stone-200">
                <h2 className="font-medium text-stone-700">
                  Recommended Schedule
                </h2>
                <p className="text-sm text-stone-400">
                  {ageMonths} month old, {numNaps} nap{numNaps > 1 ? "s" : ""}
                </p>
              </div>
              <div className="divide-y divide-stone-100">
                {schedule.map((event, index) => (
                  <div
                    key={index}
                    className="px-4 py-3 flex items-center justify-between"
                  >
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
                    <span className="text-stone-500 font-mono text-sm">
                      {event.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                This schedule uses an average awake window of{" "}
                {getAwakeWindowRange(ageMonths)}. Watch for your baby&apos;s
                sleep cues to fine-tune these times.
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
