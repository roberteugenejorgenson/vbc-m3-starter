import { NextResponse } from "next/server";
import { getEntries } from "../../../lib/supabase.js";

const EXPORT_FIELDS = [
  "id",
  "created_at",
  "requester_name",
  "location",
  "description",
  "priority",
  "status",
  "completed_at",
];

function toCsvField(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET() {
  try {
    const entries = await getEntries();
    entries.sort(
      (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
    );
    const output = [
      EXPORT_FIELDS,
      ...entries.map((entry) => EXPORT_FIELDS.map((field) => entry[field])),
    ]
      .map((row) => row.map(toCsvField).join(","))
      .join("\r\n");

    return new NextResponse(`${output}\r\n`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="morrowlane-requests.csv"',
      },
    });
  } catch (error) {
    console.error("Unable to export service requests:", error);
    return NextResponse.json(
      { error: "Could not export requests." },
      { status: 500 },
    );
  }
}
