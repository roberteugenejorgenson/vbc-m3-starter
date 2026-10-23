"use client";

import { useEffect, useState } from "react";

const LOCATIONS = ["Minneapolis", "Chicago", "Denver", "Austin"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const STATUSES = ["New", "In Progress", "Complete"];

const emptyForm = {
  requester_name: "",
  location: "",
  description: "",
  priority: "",
};

function formatDate(value) {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("en-US", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

function truncate(text) {
  if (!text) {
    return "";
  }
  if (text.length > 80) {
    return text.slice(0, 80) + "…";
  }
  return text;
}

export default function HomePage() {
  const [summary, setSummary] = useState(null);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [tableError, setTableError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [showAllRequests, setShowAllRequests] = useState(false);

  async function loadSummary() {
    try {
      const response = await fetch("/api/summary");
      if (!response.ok) {
        throw new Error("Could not load summary");
      }
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      setSummary(null);
    }
  }

  async function loadRequests() {
    try {
      const response = await fetch("/api/requests");
      if (!response.ok) {
        throw new Error("Could not load requests");
      }
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      setRequests([]);
    }
  }

  useEffect(() => {
    loadSummary();
    loadRequests();
  }, []);

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage({
          kind: "error",
          text: data.error || "Something went wrong. Please try again.",
        });
        return;
      }

      setForm(emptyForm);
      setMessage({ kind: "success", text: "Request submitted." });
      await Promise.all([loadRequests(), loadSummary()]);
    } catch (error) {
      setMessage({
        kind: "error",
        text: "Could not reach the server. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function beginEdit(request) {
    setEditingId(request.id);
    setEditForm({
      requester_name: request.requester_name,
      location: request.location,
      description: request.description,
      priority: request.priority,
      status: request.status,
    });
    setTableError("");
  }

  function handleEditChange(event) {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
  }

  async function saveEditedRequest(id) {
    setSavingId(id);
    setTableError("");

    try {
      const response = await fetch("/api/requests/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await response.json();

      if (!response.ok) {
        setTableError(data.error || "Could not save that request.");
        return;
      }

      setEditingId(null);
      setEditForm(null);
      await Promise.all([loadRequests(), loadSummary()]);
    } catch (error) {
      setTableError("Could not reach the server. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  function tileValue(key) {
    if (!summary) {
      return "–";
    }
    return summary[key];
  }

  const visibleRequests = showAllRequests
    ? requests
    : requests.filter((request) => request.status !== "Complete");

  return (
    <main className="page">
      <header className="page-header">
        <h1>Morrowlane Service Request Portal</h1>
        <p className="subtitle">Submit and track workplace service requests</p>
      </header>

      <section className="tiles">
        <div className="tile">
          <span className="tile-label">Open requests</span>
          <span className="tile-value">{tileValue("open_requests")}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Urgent open</span>
          <span className="tile-value">{tileValue("urgent_open")}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Completed this month</span>
          <span className="tile-value">{tileValue("completed_this_month")}</span>
        </div>
      </section>

      <section className="card">
        <h2>New request</h2>
        <form className="request-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="requester_name">Requester name</label>
            <input
              id="requester_name"
              name="requester_name"
              type="text"
              value={form.requester_name}
              onChange={handleFieldChange}
            />
          </div>

          <div className="field">
            <label htmlFor="location">Location</label>
            <select
              id="location"
              name="location"
              value={form.location}
              onChange={handleFieldChange}
            >
              <option value="">Select a location</option>
              {LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          <div className="field field-wide">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={500}
              value={form.description}
              onChange={handleFieldChange}
            />
            <span className="hint">{form.description.length}/500 characters</span>
          </div>

          <div className="field">
            <label htmlFor="priority">Priority</label>
            <select
              id="priority"
              name="priority"
              value={form.priority}
              onChange={handleFieldChange}
            >
              <option value="">Select a priority</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit request"}
            </button>
            {message ? (
              <span className={"form-message form-message-" + message.kind}>
                {message.text}
              </span>
            ) : null}
          </div>
        </form>
      </section>

      <section className="card">
        <div className="table-header">
          <h2>Requests</h2>
          <a
            className="export-link"
            href="/api/export"
            download="morrowlane-requests.csv"
          >
            Export CSV
          </a>
        </div>

        {tableError ? <p className="table-error">{tableError}</p> : null}

        {visibleRequests.length === 0 ? (
          <p className="empty-state">
            {requests.length === 0
              ? "No requests to show yet."
              : "No open requests to show."}
          </p>
        ) : (
          <table className="requests-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Requester</th>
                <th>Location</th>
                <th>Description</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.map((request) => (
                <tr key={request.id}>
                  <td>{formatDate(request.created_at)}</td>
                  {editingId === request.id ? (
                    <>
                      <td>
                        <input
                          type="text"
                          name="requester_name"
                          aria-label="Requester name"
                          value={editForm.requester_name}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <select name="location" aria-label="Location" value={editForm.location} onChange={handleEditChange}>
                          {LOCATIONS.map((location) => <option key={location} value={location}>{location}</option>)}
                        </select>
                      </td>
                      <td>
                        <textarea
                          name="description"
                          aria-label="Description"
                          rows={2}
                          maxLength={500}
                          value={editForm.description}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <select name="priority" aria-label="Priority" value={editForm.priority} onChange={handleEditChange}>
                          {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                        </select>
                      </td>
                      <td>
                        <select name="status" aria-label="Status" value={editForm.status} onChange={handleEditChange}>
                          {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{request.requester_name}</td>
                      <td>{request.location}</td>
                      <td>{truncate(request.description)}</td>
                      <td>
                        <span
                          className={
                            "badge badge-" + String(request.priority).toLowerCase()
                          }
                        >
                          {request.priority}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            "badge badge-status badge-status-" +
                            request.status.toLowerCase().replaceAll(" ", "-")
                          }
                        >
                          {request.status}
                        </span>
                      </td>
                    </>
                  )}
                  <td>
                    {editingId === request.id ? (
                      <div className="row-actions">
                        <button
                          type="button"
                          className="row-action row-action-save"
                          disabled={savingId === request.id}
                          onClick={() => saveEditedRequest(request.id)}
                        >
                          {savingId === request.id ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="row-action"
                          disabled={savingId === request.id}
                          onClick={() => { setEditingId(null); setEditForm(null); }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="row-action"
                        onClick={() => beginEdit(request)}
                        disabled={editingId !== null}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="request-list-footer">
          <button
            type="button"
            className="row-action"
            onClick={() => setShowAllRequests((showingAll) => !showingAll)}
          >
            {showAllRequests ? "Show open requests only" : "Show all records"}
          </button>
        </div>
      </section>
    </main>
  );
}
