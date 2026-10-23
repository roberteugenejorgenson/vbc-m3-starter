import { NextResponse } from "next/server";
import { supabaseRequest } from "../../../../lib/supabase.js";

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
      return NextResponse.json(
        { error: "Provide at least one field to update." },
        { status: 400 },
      );
    }
    if (
      updates.location &&
      !["Minneapolis", "Chicago", "Denver", "Austin"].includes(updates.location)
    ) {
      return NextResponse.json(
        { error: "Location must be Minneapolis, Chicago, Denver, or Austin." },
        { status: 400 },
      );
    }
    if (
      updates.priority &&
      !["Low", "Medium", "High", "Urgent"].includes(updates.priority)
    ) {
      return NextResponse.json(
        { error: "Priority must be Low, Medium, High, or Urgent." },
        { status: 400 },
      );
    }
    if (
      updates.status &&
      !["New", "In Progress", "Complete"].includes(updates.status)
    ) {
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

    const entries = await supabaseRequest(`entries?id=eq.${requestId}&select=*`);
    const existingEntry = entries[0];
    if (!existingEntry) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    if (updates.status === "Complete" && existingEntry.status !== "Complete") {
      updates.completed_at = new Date().toISOString();
    } else if (updates.status && updates.status !== "Complete") {
      updates.completed_at = null;
    }

    const [updatedEntry] = await supabaseRequest(
      `entries?id=eq.${requestId}&select=*`,
      {
        method: "PATCH",
        body: updates,
        prefer: "return=representation",
      },
    );
    if (!updatedEntry) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    return NextResponse.json({ request: updatedEntry });
  } catch (error) {
    console.error("Unable to update service request:", error);
    return NextResponse.json(
      { error: "Could not update request." },
      { status: 500 },
    );
  }
}
