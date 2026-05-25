import { useState, useEffect } from "react";
import Modal from "./ui/modal/Modal";
import Button from "./ui/button/Button";
import styles from "./ParameterizeModal.module.css";

function extractAllPaths(obj, prefix = "") {
  let paths = [];

  if (obj === null || obj === undefined) {
    return [{
      key: prefix,
      value: "null",
      type: "null",
      parameterize: false
    }];
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      paths.push({
        key: prefix,
        value: "[]",
        type: "array",
        parameterize: false
      });
    } else {
      const isPrimitiveArray = obj.every(x => typeof x !== "object" || x === null);
      if (isPrimitiveArray) {
        paths.push({
          key: prefix,
          value: JSON.stringify(obj),
          type: "array",
          parameterize: false
        });
      } else {
        obj.forEach((item, index) => {
          paths.push(...extractAllPaths(item, `${prefix}[${index}]`));
        });
      }
    }
  } else if (typeof obj === "object") {
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      paths.push({
        key: prefix,
        value: "{}",
        type: "object",
        parameterize: false
      });
    } else {
      keys.forEach(k => {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        paths.push(...extractAllPaths(obj[k], fullKey));
      });
    }
  } else {
    paths.push({
      key: prefix,
      value: String(obj),
      type: typeof obj,
      parameterize: false
    });
  }

  return paths;
}

function restorePlaceholders(obj, placeholders) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      if (typeof item === "string") {
        placeholders.forEach(p => {
          if (item === p.id) obj[index] = p.original;
          else if (item.includes(p.id)) obj[index] = item.replaceAll(p.id, p.original);
        });
      } else {
        restorePlaceholders(item, placeholders);
      }
    });
  } else {
    Object.keys(obj).forEach(key => {
      let val = obj[key];
      if (typeof val === "string") {
        placeholders.forEach(p => {
          if (val === p.id) obj[key] = p.original;
          else if (val.includes(p.id)) obj[key] = val.replaceAll(p.id, p.original);
        });
      } else {
        restorePlaceholders(val, placeholders);
      }
    });
  }
}

function dirtyJsonParse(str) {
  if (typeof str !== "string") return str;
  let clean = str.trim();
  if (!clean) return null;

  try {
    return JSON.parse(clean);
  } catch (e) {
    // continue to relaxed parsing
  }

  try {
    clean = clean.replace(/\/\/.*$/gm, "");
    clean = clean.replace(/\/\*[\s\S]*?\*\//g, "");

    const placeholders = [];
    clean = clean.replace(/\{{1,2}([a-zA-Z0-9_\-\.]+?)\}{1,2}/g, (match) => {
      const tempId = `__TEMPLATE_PLACEHOLDER_${placeholders.length}__`;
      placeholders.push({ id: tempId, original: match });
      return `"${tempId}"`;
    });

    const obj = new Function(`return (${clean});`)();
    restorePlaceholders(obj, placeholders);
    return obj;
  } catch (err) {
    console.warn("Failed to parse relaxed JSON:", err);
    throw err;
  }
}

/**
 * Parses a JSON payload string into an array of rows with
 * key, value, type, and parameterize flag.
 */
function parsePayloadToRows(payload) {
  try {
    const obj = dirtyJsonParse(payload);
    if (obj && typeof obj === "object") {
      return extractAllPaths(obj);
    }
  } catch (err) {
    console.error("Failed parsing relaxed payload:", err);
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

function setNestedValueByPath(obj, path, value) {
  const parts = path.split(/\.|\b(?=\[)|\]\.?|\[|\]/g).filter(Boolean);
  
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const isNextNumber = /^\d+$/.test(nextPart);
    
    if (current[part] === undefined || current[part] === null) {
      current[part] = isNextNumber ? [] : {};
    }
    current = current[part];
  }
  
  const lastPart = parts[parts.length - 1];
  if (current) {
    current[lastPart] = value;
  }
}

  function handleApply() {
    try {
      const obj = typeof payload === "string" ? JSON.parse(payload) : JSON.parse(JSON.stringify(payload));
      
      rows.forEach(row => {
        if (row.parameterize && row.key !== "(raw)") {
          // Extract the leaf key name from the path (e.g. "user.name" → "name", "items[0].id" → "id")
          const leafKey = row.key.split(/[.\[\]]/).filter(Boolean).pop() || row.key;
          setNestedValueByPath(obj, row.key, `{${leafKey}}`);
        }
      });

      const beautifiedPayload = JSON.stringify(obj, null, 2);
      onApply(rows, beautifiedPayload);
    } catch (e) {
      onApply(rows, payload);
    }
    onClose();
  }

  const paramCount = rows.filter((r) => r.parameterize).length;

  return (
    <Modal title="Parameterize Payload" onClose={onClose} size="xl">
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
