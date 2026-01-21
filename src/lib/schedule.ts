// Awake windows by age (in minutes) from Sasha Romary's guide
const AWAKE_WINDOWS: Record<string, { min: number; max: number }> = {
  "0-3": { min: 45, max: 60 },
  "3-6": { min: 90, max: 150 },
  "6-9": { min: 120, max: 180 },
  "9-12": { min: 180, max: 240 },
};

export interface ScheduleInput {
  ageMonths: number;
  numNaps: number;
  wakeTime: string; // HH:MM format
}

export interface ScheduleEvent {
  time: string;
  label: string;
  type: "wake" | "nap" | "bedtime";
}

function parseTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes: number): string {
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`;
}

function getAwakeWindow(ageMonths: number): { min: number; max: number } {
  if (ageMonths < 3) return AWAKE_WINDOWS["0-3"];
  if (ageMonths < 6) return AWAKE_WINDOWS["3-6"];
  if (ageMonths < 9) return AWAKE_WINDOWS["6-9"];
  return AWAKE_WINDOWS["9-12"];
}

// Typical nap durations vary by age and which nap it is
function getNapDuration(ageMonths: number, napNumber: number, totalNaps: number): number {
  // Last nap is usually shorter (catnap)
  const isLastNap = napNumber === totalNaps;

  if (ageMonths < 3) {
    return isLastNap ? 30 : 45;
  } else if (ageMonths < 6) {
    return isLastNap ? 30 : 60;
  } else if (ageMonths < 9) {
    return isLastNap ? 30 : 75;
  } else {
    return isLastNap ? 30 : 90;
  }
}

export function generateSchedule(input: ScheduleInput): ScheduleEvent[] {
  const { ageMonths, numNaps, wakeTime } = input;
  const schedule: ScheduleEvent[] = [];

  const awakeWindow = getAwakeWindow(ageMonths);
  // Use average of min/max for the awake window
  const avgAwakeWindow = Math.round((awakeWindow.min + awakeWindow.max) / 2);

  let currentTime = parseTime(wakeTime);

  // Morning wake up
  schedule.push({
    time: formatTime(currentTime),
    label: "Wake up",
    type: "wake",
  });

  // Generate naps
  for (let i = 1; i <= numNaps; i++) {
    // Add awake window to get to nap start
    currentTime += avgAwakeWindow;

    const napLabel = numNaps === 1 ? "Nap" : `Nap ${i}`;
    schedule.push({
      time: formatTime(currentTime),
      label: napLabel,
      type: "nap",
    });

    // Add nap duration
    const napDuration = getNapDuration(ageMonths, i, numNaps);
    currentTime += napDuration;
  }

  // Add final awake window for bedtime
  currentTime += avgAwakeWindow;

  // Ensure bedtime is reasonable (between 6pm and 9pm typically)
  const bedtimeMinutes = currentTime;
  const sixPM = 18 * 60;
  const ninePM = 21 * 60;

  // If calculated bedtime is too early or late, note it but still show it
  schedule.push({
    time: formatTime(bedtimeMinutes),
    label: "Bedtime",
    type: "bedtime",
  });

  return schedule;
}

export function getAwakeWindowRange(ageMonths: number): string {
  const window = getAwakeWindow(ageMonths);
  if (window.min < 60) {
    return `${window.min}-${window.max} minutes`;
  }
  const minHours = window.min / 60;
  const maxHours = window.max / 60;
  return `${minHours}-${maxHours} hours`;
}

export function getSuggestedNaps(ageMonths: number): number {
  if (ageMonths < 3) return 4;
  if (ageMonths < 6) return 3;
  if (ageMonths < 9) return 3;
  return 2;
}
