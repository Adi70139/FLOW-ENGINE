import { useState, useEffect } from "react";
import IconButton from "./ui/icon-button/IconButton";
import Button from "./ui/button/Button";
import styles from "./KeyValueTable.module.css";

/**
 * Reusable key-value table for headers and body params.
 * Each row: { key, value, enabled }
 */
function KeyValueTable({
  rows = [],
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}) {
  const [localRows, setLocalRows] = useState(rows);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  function emit(nextRows) {
    setLocalRows(nextRows);
    onChange && onChange(nextRows);
  }

  function updateRow(i, patch) {
    const next = [...localRows];
    next[i] = { ...next[i], ...patch };
    emit(next);
  }

  function addRow() {
    emit([...localRows, { key: "", value: "", enabled: true }]);
  }

  function removeRow(i) {
    emit(localRows.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.toggleCol}>On</th>
            <th className={styles.keyCol}>{keyPlaceholder}</th>
            <th className={styles.valCol}>{valuePlaceholder}</th>
            <th className={styles.actionCol}></th>
          </tr>
        </thead>
        <tbody>
          {localRows.map((r, i) => (
            <tr
              key={i}
              className={r.enabled === false ? styles.disabledRow : ""}
            >
              <td style={{ textAlign: "center" }}>
                <input
                  type="checkbox"
                  className={styles.toggle}
                  checked={r.enabled !== false}
                  onChange={(e) => updateRow(i, { enabled: e.target.checked })}
                />
              </td>
              <td>
                <input
                  className={styles.cellInput}
                  value={r.key || ""}
                  onChange={(e) => updateRow(i, { key: e.target.value })}
                  placeholder={keyPlaceholder}
                />
              </td>
              <td>
                <input
                  className={styles.cellInput}
                  value={r.value || ""}
                  onChange={(e) => updateRow(i, { value: e.target.value })}
                  placeholder={valuePlaceholder}
                />
              </td>
              <td style={{ textAlign: "center" }}>
                <IconButton
                  size="small"
                  variant="danger"
                  title="Remove"
                  onClick={() => removeRow(i)}
                >
                  ✕
                </IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.footer}>
        <Button variant="ghost" size="small" onClick={addRow} icon="＋">
          Add row
        </Button>
      </div>
    </div>
  );
}

export default KeyValueTable;
