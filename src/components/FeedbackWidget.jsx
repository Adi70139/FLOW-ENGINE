import { useState, useEffect, useCallback } from "react";
import { api } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "./ui/toast/toast";
import styles from "./FeedbackWidget.module.css";

const TYPES = ["BUG", "FEATURE_REQUEST", "GENERAL"];
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"];
const PAGE_SIZE = 10;

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function FeedbackItem({ item, isAdmin, onStatusChange }) {
  return (
    <div className={styles.item}>
      <div className={styles.itemHead}>
        <div className={styles.itemTitle}>{item.title || "(no title)"}</div>
        {isAdmin ? (
          <select
            className={styles.statusSelect}
            value={item.status}
            onChange={(e) => onStatusChange(item.id, e.target.value)}
            aria-label="Update status"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : (
          <span className={`${styles.badge} ${styles[`status${item.status}`] || ""}`}>
            {item.status}
          </span>
        )}
      </div>
      {item.description && <div className={styles.itemDesc}>{item.description}</div>}
      <div className={styles.itemMeta}>
        <span className={`${styles.badge} ${styles[`type${item.type}`] || ""}`}>{item.type}</span>
        {item.severity && (
          <span className={`${styles.badge} ${styles[`sev${item.severity}`] || ""}`}>
            {item.severity}
          </span>
        )}
        <span>•</span>
        <span>{formatDate(item.createdAt)}</span>
        {item.submittedBy && (
          <>
            <span>•</span>
            <span>{item.submittedBy}</span>
          </>
        )}
      </div>
      {item.pageUrl && <div className={styles.pageUrl}>{item.pageUrl}</div>}
    </div>
  );
}

function SubmitTab({ onSubmitted }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("BUG");
  const [severity, setSeverity] = useState("MEDIUM");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setBusy(true);
    try {
      await api.submitFeedback({
        title: title.trim(),
        description: description.trim(),
        type,
        severity,
        pageUrl: window.location.href,
      });
      toast.success("Feedback submitted. Thanks!");
      setTitle("");
      setDescription("");
      setType("BUG");
      setSeverity("MEDIUM");
      onSubmitted?.();
    } catch (err) {
      setError(err?.message || "Failed to submit feedback.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.body} onSubmit={handleSubmit} style={{ paddingBottom: 16 }}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="fb-title">Title</label>
        <input
          id="fb-title"
          className={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short summary"
          maxLength={120}
          disabled={busy}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="fb-desc">Description</label>
        <textarea
          id="fb-desc"
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Steps to reproduce, what you expected, what happened…"
          disabled={busy}
          required
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="fb-type">Type</label>
          <select
            id="fb-type"
            className={styles.select}
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={busy}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t.replace("_", " ")}</option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="fb-sev">Severity</label>
          <select
            id="fb-sev"
            className={styles.select}
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            disabled={busy}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Page URL</label>
        <div className={styles.pageUrl}>{window.location.href}</div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.actions}>
        <button type="submit" className={styles.primaryBtn} disabled={busy}>
          {busy ? "Submitting…" : "Submit feedback"}
        </button>
      </div>
    </form>
  );
}

function ListTab({ scope, isAdmin }) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = scope === "mine"
        ? await api.listMyFeedback({ page, size: PAGE_SIZE })
        : await api.listAllFeedback({
            page,
            size: PAGE_SIZE,
            status: statusFilter || undefined,
            type: typeFilter || undefined,
          });
      setData(res);
    } catch (err) {
      setError(err?.message || "Failed to load feedback.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [scope, page, statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setPage(0); }, [scope, statusFilter, typeFilter]);

  async function handleStatusChange(id, status) {
    try {
      await api.updateFeedbackStatus(id, status);
      toast.success(`Status updated to ${status}`);
      load();
    } catch (err) {
      toast.error(err?.message || "Failed to update status.");
    }
  }

  const items = data?.content || [];
  const totalPages = data?.totalPages ?? 0;
  const isAllScope = scope === "all";

  return (
    <div className={styles.body}>
      {isAllScope && (
        <div className={styles.toolbar}>
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            className={styles.select}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            {TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {loading && <div className={styles.empty}>Loading…</div>}

      {!loading && items.length === 0 && (
        <div className={styles.empty}>No feedback yet.</div>
      )}

      {!loading && items.length > 0 && (
        <div className={styles.list}>
          {items.map((it) => (
            <FeedbackItem
              key={it.id}
              item={it}
              isAdmin={isAllScope && isAdmin}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ← Prev
          </button>
          <span className={styles.pageInfo}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page + 1 >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export default function FeedbackWidget() {
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("submit");
  const isAdmin = user?.role === "ADMIN";

  // Reset tab if a non-admin somehow lands on "all"
  useEffect(() => {
    if (!isAdmin && tab === "all") setTab("submit");
  }, [isAdmin, tab]);

  if (!isAuthenticated) return null;

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        onClick={() => setOpen((v) => !v)}
        aria-label="Send feedback"
        aria-expanded={open}
      >
        <span className={styles.fabIcon}>💬</span>
        Feedback
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Feedback">
          <div className={styles.header}>
            <h3 className={styles.title}>Feedback</h3>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setOpen(false)}
              aria-label="Close feedback panel"
            >
              ×
            </button>
          </div>

          <div className={styles.tabs} role="tablist">
            <button
              role="tab"
              aria-selected={tab === "submit"}
              className={`${styles.tab} ${tab === "submit" ? styles.tabActive : ""}`}
              onClick={() => setTab("submit")}
            >
              Submit
            </button>
            <button
              role="tab"
              aria-selected={tab === "mine"}
              className={`${styles.tab} ${tab === "mine" ? styles.tabActive : ""}`}
              onClick={() => setTab("mine")}
            >
              My feedback
            </button>
            {isAdmin && (
              <button
                role="tab"
                aria-selected={tab === "all"}
                className={`${styles.tab} ${tab === "all" ? styles.tabActive : ""}`}
                onClick={() => setTab("all")}
              >
                All feedback
              </button>
            )}
          </div>

          {tab === "submit" && <SubmitTab onSubmitted={() => setTab("mine")} />}
          {tab === "mine" && <ListTab scope="mine" isAdmin={false} />}
          {tab === "all" && isAdmin && <ListTab scope="all" isAdmin />}
        </div>
      )}
    </>
  );
}
