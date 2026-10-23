const REQUEST_FIELDS =
  "id,created_at,requester_name,location,description,priority,status,completed_at";

export async function supabaseRequest(path, { method = "GET", body, prefer } = {}) {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY) must be configured.",
    );
  }

  const headers = {
    apikey: supabaseKey,
    Accept: "application/json",
  };
  if (supabaseKey.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${supabaseKey}`;
  }

  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase request failed (${response.status}): ${responseText || response.statusText}`,
    );
  }

  return responseText ? JSON.parse(responseText) : null;
}

export async function getEntries() {
  return supabaseRequest(`entries?select=${REQUEST_FIELDS}`);
}

export function sortEntries(entries) {
  const statusOrder = ["New", "In Progress", "Complete"];
  return [...entries].sort((left, right) => {
    const leftStatus = statusOrder.indexOf(left.status);
    const rightStatus = statusOrder.indexOf(right.status);
    const statusDifference =
      (leftStatus < 0 ? statusOrder.length : leftStatus) -
      (rightStatus < 0 ? statusOrder.length : rightStatus);

    if (statusDifference !== 0) return statusDifference;
    return Date.parse(right.created_at) - Date.parse(left.created_at);
  });
}
