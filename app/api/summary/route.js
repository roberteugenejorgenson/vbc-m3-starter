import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export async function GET() {
  try {
    const csvPath = path.join(process.cwd(), "data", "seed-requests.csv");
    const csv = await readFile(csvPath, "utf8");
    const rows = parseCsv(csv);
    const headers = rows.shift() ?? [];
    const requests = rows
      .filter((row) => row.some((field) => field.trim()))
      .map((values) => {
        return Object.fromEntries(
          headers.map((header, index) => [header, values[index] ?? ""]),
        );
      });

    const openRequests = requests.filter((request) => request.status !== "Complete");
    const today = new Date();
    const completedThisMonth = requests.filter((request) => {
      const completedAt = request.completed_at ? new Date(request.completed_at) : null;
      return (
        request.status === "Complete" &&
        completedAt &&
        completedAt.getFullYear() === today.getFullYear() &&
        completedAt.getMonth() === today.getMonth()
      );
    }).length;

    return NextResponse.json({
      open_requests: openRequests.length,
      urgent_open: openRequests.filter((request) => request.priority === "Urgent").length,
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
