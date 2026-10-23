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

function toCsvField(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET() {
  try {
    const csvPath = path.join(process.cwd(), "data", "seed-requests.csv");
    const rows = parseCsv(await readFile(csvPath, "utf8"));
    const sourceHeaders = rows.shift() ?? [];
    const dataRows = rows.filter((row) => row.some((field) => field.trim()));
    const requests = dataRows.map((values, index) => ({
      id: index + 1,
      ...Object.fromEntries(
        sourceHeaders.map((header, fieldIndex) => [header, values[fieldIndex] ?? ""]),
      ),
    }));
    requests.sort(
      (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
    );

    const headers = ["id", ...sourceHeaders];
    const output = [headers, ...requests.map((request) => headers.map((header) => request[header]))]
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
