import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseHabitsExport } from "@/lib/habits";

export async function GET() {
  try {
    const exportDir = path.resolve(process.cwd(), "..", "export_1770248675244");
    const activitiesPath = path.join(exportDir, "activities.csv");
    const sessionsPath = path.join(exportDir, "sessions.csv");

    const [activitiesCsv, sessionsCsv] = await Promise.all([
      readFile(activitiesPath, "utf8"),
      readFile(sessionsPath, "utf8"),
    ]);

    const data = parseHabitsExport(activitiesCsv, sessionsCsv);
    return NextResponse.json({ ...data, source: "export_1770248675244" });
  } catch (error) {
    console.error("Habit import failed", error);
    return NextResponse.json(
      { error: "Habit import failed" },
      { status: 500 }
    );
  }
}
