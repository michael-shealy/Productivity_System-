// Lightweight sanity checks for the UTC boundary conversion used in executeReadOnlyTool("get_events").
// Run manually with: node ./scripts/testUtcBounds.cjs (after transpiling) or by adapting to your test framework.

function getWeekdayLabel(d: Date): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

type Case = {
  startDate: string;
  endDate: string;
  expectedStartWeekdayUtc: string;
  expectedEndWeekdayUtc: string;
};

const cases: Case[] = [
  // Weekend around 2026-02-14/15/16 (known dates from your example)
  {
    startDate: "2026-02-14", // Saturday
    endDate: "2026-02-16", // Monday
    expectedStartWeekdayUtc: "Sat",
    expectedEndWeekdayUtc: "Mon",
  },
  {
    startDate: "2026-02-15", // Sunday
    endDate: "2026-02-15", // Sunday
    expectedStartWeekdayUtc: "Sun",
    expectedEndWeekdayUtc: "Sun",
  },
];

for (const c of cases) {
  const timeMinDate = new Date(c.startDate + "T00:00:00Z");
  const timeMaxDate = new Date(c.endDate + "T23:59:59Z");

  const startLabel = getWeekdayLabel(timeMinDate);
  const endLabel = getWeekdayLabel(timeMaxDate);

  assert(
    startLabel === c.expectedStartWeekdayUtc,
    `Start weekday mismatch for ${c.startDate}: expected ${c.expectedStartWeekdayUtc}, got ${startLabel}`
  );
  assert(
    endLabel === c.expectedEndWeekdayUtc,
    `End weekday mismatch for ${c.endDate}: expected ${c.expectedEndWeekdayUtc}, got ${endLabel}`
  );
}

console.log("UTC boundary weekday checks passed for", cases.length, "cases.");

