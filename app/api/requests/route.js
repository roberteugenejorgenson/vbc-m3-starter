import { NextResponse } from "next/server";
import { getEntries, sortEntries, supabaseRequest } from "../../../lib/supabase.js";

export async function GET() {
  try {
    const requests = sortEntries(await getEntries());
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
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 },
      );
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

    const entry = {
      requester_name: body.requester_name.trim(),
      location: body.location.trim(),
      description: body.description.trim(),
      priority: body.priority.trim(),
      status: "New",
      completed_at: null,
    };

    if (!["Minneapolis", "Chicago", "Denver", "Austin"].includes(entry.location)) {
      return NextResponse.json(
        { error: "Location must be Minneapolis, Chicago, Denver, or Austin." },
        { status: 400 },
      );
    }
    if (!["Low", "Medium", "High", "Urgent"].includes(entry.priority)) {
      return NextResponse.json(
        { error: "Priority must be Low, Medium, High, or Urgent." },
        { status: 400 },
      );
    }
    if (entry.description.length > 500) {
      return NextResponse.json(
        { error: "Description must be 500 characters or fewer." },
        { status: 400 },
      );
    }

    const [savedEntry] = await supabaseRequest("entries?select=*", {
      method: "POST",
      body: entry,
      prefer: "return=representation",
    });

    return NextResponse.json({ request: savedEntry }, { status: 201 });
  } catch (error) {
    console.error("Unable to save service request:", error);
    return NextResponse.json(
      { error: "Could not save request." },
      { status: 500 },
    );
  }
}
