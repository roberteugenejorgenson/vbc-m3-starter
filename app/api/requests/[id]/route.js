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

export async function PATCH(request, { params }) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 },
      );
    }

    const editableFields = ["requester_name", "location", "description", "priority", "status"];
    const updates = {};
    for (const field of editableFields) {
      if (Object.hasOwn(body ?? {}, field)) {
        if (typeof body[field] !== "string" || !body[field].trim()) {
          return NextResponse.json(
            { error: `${field.replaceAll("_", " ")} is required.` },
            { status: 400 },
          );
        }
        updates[field] = body[field].trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Provide at least one field to update." }, { status: 400 });
    }
    if (updates.location && !["Minneapolis", "Chicago", "Denver", "Austin"].includes(updates.location)) {
      return NextResponse.json(
        { error: "Location must be Minneapolis, Chicago, Denver, or Austin." },
        { status: 400 },
      );
    }
    if (updates.priority && !["Low", "Medium", "High", "Urgent"].includes(updates.priority)) {
      return NextResponse.json(
        { error: "Priority must be Low, Medium, High, or Urgent." },
        { status: 400 },
      );
    }
    if (updates.status && !["New", "In Progress", "Complete"].includes(updates.status)) {
      return NextResponse.json(
        { error: "Status must be New, In Progress, or Complete." },
        { status: 400 },
      );
    }
    if (updates.description && updates.description.length > 500) {
      return NextResponse.json(
        { error: "Description must be 500 characters or fewer." },
        { status: 400 },
      );
    }

    const requestId = Number((await params).id);
    if (!Number.isInteger(requestId) || requestId < 1) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    const csvPath = path.join(process.cwd(), "data", "seed-requests.csv");
    const rows = parseCsv(await readFile(csvPath, "utf8"));
    const headers = rows[0] ?? [];
    const dataRows = rows.slice(1).filter((row) => row.some((field) => field.trim()));
    const targetRow = dataRows[requestId - 1];

    if (!targetRow) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    const statusIndex = headers.indexOf("status");
    const previousStatus = targetRow[statusIndex];
    let completedAtIndex = headers.indexOf("completed_at");
    if (completedAtIndex < 0) {
      headers.push("completed_at");
      completedAtIndex = headers.length - 1;
      dataRows.forEach((row) => row.push(""));
    }

    for (const [field, value] of Object.entries(updates)) {
      const fieldIndex = headers.indexOf(field);
      if (fieldIndex >= 0) targetRow[fieldIndex] = value;
    }
    if (updates.status === "Complete" && previousStatus !== "Complete") {
      targetRow[completedAtIndex] = new Date().toISOString();
    } else if (updates.status && updates.status !== "Complete") {
      targetRow[completedAtIndex] = "";
    }
    const updatedRequest = Object.fromEntries(
      headers.map((header, index) => [header, targetRow[index] ?? ""]),
    );
    const serializedCsv = [headers, ...dataRows]
      .map((row) => row.map(toCsvField).join(","))
      .join("\n");

    await writeFile(csvPath, `${serializedCsv}\n`, "utf8");
    return NextResponse.json({ request: { id: requestId, ...updatedRequest } });
  } catch (error) {
    console.error("Unable to update service request:", error);
    return NextResponse.json(
      { error: "Could not update request." },
      { status: 500 },
    );
  }
}
