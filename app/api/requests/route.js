import { readFile, writeFile } from "node:fs/promises";
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
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET() {
  try {
    const csvPath = path.join(process.cwd(), "data", "seed-requests.csv");
    const csv = await readFile(csvPath, "utf8");
    const rows = parseCsv(csv);
    const headers = rows.shift() ?? [];

    const requests = rows
      .filter((row) => row.some((field) => field.trim()))
      .map((values, index) => {
        const record = Object.fromEntries(
          headers.map((header, fieldIndex) => [header, values[fieldIndex] ?? ""]),
        );

        return { id: index + 1, ...record };
      })
      .sort((left, right) => {
        const statusOrder = ["New", "In Progress", "Complete"];
        const statusDifference = statusOrder.indexOf(left.status) - statusOrder.indexOf(right.status);
        if (statusDifference !== 0) return statusDifference;
        return Date.parse(right.created_at) - Date.parse(left.created_at);
      });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Unable to load service requests:", error);
    return NextResponse.json(
      { error: "Could not load requests." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const requiredFields = ["requester_name", "location", "description", "priority"];
    for (const field of requiredFields) {
      if (typeof body?.[field] !== "string" || !body[field].trim()) {
        return NextResponse.json(
          { error: `${field.replaceAll("_", " ")} is required.` },
          { status: 400 },
        );
      }
    }

    const requesterName = body.requester_name.trim();
    const location = body.location.trim();
    const description = body.description.trim();
    const priority = body.priority.trim();

    if (!["Minneapolis", "Chicago", "Denver", "Austin"].includes(location)) {
      return NextResponse.json(
        { error: "Location must be Minneapolis, Chicago, Denver, or Austin." },
        { status: 400 },
      );
    }
    if (!["Low", "Medium", "High", "Urgent"].includes(priority)) {
      return NextResponse.json(
        { error: "Priority must be Low, Medium, High, or Urgent." },
        { status: 400 },
      );
    }
    if (description.length > 500) {
      return NextResponse.json(
        { error: "Description must be 500 characters or fewer." },
        { status: 400 },
      );
    }

    const csvPath = path.join(process.cwd(), "data", "seed-requests.csv");
    const csv = await readFile(csvPath, "utf8");
    const rows = parseCsv(csv);
    const headers = rows[0] ?? [];
    const existingRows = rows.slice(1).filter((row) => row.some((field) => field.trim()));
    if (!headers.includes("completed_at")) {
      headers.push("completed_at");
      existingRows.forEach((row) => row.push(""));
    }
    const entry = {
      id: existingRows.length + 1,
      created_at: new Date().toISOString(),
      requester_name: requesterName,
      location,
      description,
      priority,
      status: "New",
      completed_at: "",
    };
    const newRow = headers.map((header) => entry[header] ?? "");
    const serializedCsv = [headers, ...existingRows, newRow]
      .map((row) => row.map(toCsvField).join(","))
      .join("\n");
    await writeFile(csvPath, `${serializedCsv}\n`, "utf8");
    return NextResponse.json({ request: entry }, { status: 201 });
  } catch (error) {
    console.error("Unable to save service request:", error);
    return NextResponse.json(
      { error: "Could not save request." },
      { status: 500 },
    );
  }
}
