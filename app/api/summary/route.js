import { NextResponse } from "next/server";
import { getEntries } from "../../../lib/supabase.js";

export async function GET() {
  try {
    const entries = await getEntries();
    const openEntries = entries.filter((entry) => entry.status !== "Complete");
    const today = new Date();
    const completedThisMonth = entries.filter((entry) => {
      const completedAt = entry.completed_at ? new Date(entry.completed_at) : null;
      return (
        entry.status === "Complete" &&
        completedAt &&
        completedAt.getFullYear() === today.getFullYear() &&
        completedAt.getMonth() === today.getMonth()
      );
    }).length;

    return NextResponse.json({
      open_requests: openEntries.length,
      urgent_open: openEntries.filter((entry) => entry.priority === "Urgent").length,
      completed_this_month: completedThisMonth,
    });
  } catch (error) {
    console.error("Unable to load service request summary:", error);
    return NextResponse.json(
      { error: "Could not load summary." },
      { status: 500 },
    );
  }
}
