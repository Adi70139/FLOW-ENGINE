import { useState, useEffect } from "react";
import Modal from "./ui/modal/Modal";
import Button from "./ui/button/Button";
import styles from "./ParameterizeModal.module.css";

/**
 * Parses a JSON payload string into an array of rows with
 * key, value, type, and parameterize flag.
 */
function parsePayloadToRows(payload) {
  try {
    const obj = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return Object.entries(obj).map(([key, val]) => ({
        key,
        value: typeof val === "object" ? JSON.stringify(val) : String(val),
        type: typeof val === "object"
          ? Array.isArray(val) ? "array" : "object"
          : typeof val,
        parameterize: false,
      }));
    }
  } catch {
    /* not valid JSON */
  }
  // Fallback: treat the whole payload as a single row
  if (payload && payload.trim()) {
    return [{ key: "(raw)", value: payload, type: "string", parameterize: false }];
  }
  return [];
}

function ParameterizeModal({ payload, existingFields = [], onClose, onApply }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const fresh = parsePayloadToRows(payload);
    // Restore any previously-toggled state
    const existingMap = Object.fromEntries(
      existingFields.map((f) => [f.key, f.parameterize])
    );
    setRows(
      fresh.map((r) => ({
        ...r,
        parameterize: existingMap[r.key] ?? false,
      }))
    );
  }, [payload]);

  function toggleRow(index) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, parameterize: !r.parameterize } : r
      )
    );
  }

  function handleApply() {
    try {
      const obj = typeof payload === "string" ? JSON.parse(payload) : { ...payload };
      
      rows.forEach(row => {
        if (row.parameterize && row.key !== "(raw)") {
          obj[row.key] = "";
        }
      });

      const beautifiedPayload = JSON.stringify(obj, null, 2);
      onApply(rows, beautifiedPayload);
    } catch (e) {
      // If it's not valid JSON, we just pass the rows back
      onApply(rows, payload);
    }
    onClose();
  }

  const paramCount = rows.filter((r) => r.parameterize).length;

  return (
    <Modal title="Parameterize Payload" onClose={onClose} size="lg">
      <div className={styles.modalBody}>
        <p className={styles.description}>
          Toggle the fields you want to parameterize. Parameterized fields can be
          dynamically replaced with different values when running tests in a collection.
        </p>

        {rows.length === 0 ? (
          <div className={styles.emptyState}>
            No payload to parameterize. Add a JSON body first.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Type</th>
                <th className={styles.paramCol}>Parameterize</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className={styles.keyCell}>{row.key}</td>
                  <td className={styles.valueCell} title={row.value}>
                    {row.value}
                  </td>
                  <td className={styles.typeCell}>{row.type}</td>
                  <td style={{ textAlign: "center" }}>
                    <label className={styles.toggleSwitch}>
                      <input
                        type="checkbox"
                        checked={row.parameterize}
                        onChange={() => toggleRow(i)}
                      />
                      <span className={styles.toggleTrack} />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className={styles.footer}>
          <span style={{ flex: 1, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
            {paramCount > 0
              ? `${paramCount} field${paramCount > 1 ? "s" : ""} selected for parameterization`
              : "No fields selected"}
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={rows.length === 0}>
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ParameterizeModal;
