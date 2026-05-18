import { useState, useEffect, useRef } from "react";
import IconButton from "./ui/icon-button/IconButton";
import Button from "./ui/button/Button";
import Input from "./ui/input/Input";
import { IconDelete, IconPlus } from "./ui/icons/Icons";
import styles from "./KeyValueTable.module.css";

function KeyValueTable({
  rows = [],
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}) {
  const [localRows, setLocalRows] = useState(
    rows.length ? rows : [{ key: "", value: "", enabled: true }]
  );

  useEffect(() => {
    const parentNonEmpty = rows.filter(r => r.key?.trim() || r.value?.trim());
    const localNonEmpty = localRows.filter(r => r.key?.trim() || r.value?.trim());
    
    if (JSON.stringify(parentNonEmpty) !== JSON.stringify(localNonEmpty)) {
      setLocalRows(rows.length ? rows : [{ key: "", value: "", enabled: true }]);
    }
  }, [rows, localRows]);


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
    const next = localRows.filter((_, idx) => idx !== i);
    emit(next.length ? next : [{ key: "", value: "", enabled: true }]);
  }

  return (
    <div className={styles.container}>
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
            <tr key={i} className={r.enabled === false ? styles.disabledRow : ""}>
              <td className={styles.toggleCol}>
                <input
                  type="checkbox"
                  className={styles.toggle}
                  checked={r.enabled !== false}
                  onChange={(e) => updateRow(i, { enabled: e.target.checked })}
                />
              </td>
              <td className={styles.keyCol}>
                <input
                  className={styles.cellInput}
                  value={r.key}
                  onChange={(e) => updateRow(i, { key: e.target.value })}
                  placeholder={keyPlaceholder}
                />
              </td>
              <td className={styles.valCol}>
                <input
                  className={styles.cellInput}
                  value={r.value}
                  onChange={(e) => updateRow(i, { value: e.target.value })}
                  placeholder={valuePlaceholder}
                />
              </td>
              <td className={styles.actionCol}>
                <IconButton 
                  size="small" 
                  variant="ghost" 
                  onClick={() => removeRow(i)}
                  className={styles.deleteBtn}
                >
                  <IconDelete size={14} />
                </IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.footer}>
        <Button 
          variant="secondary" 
          size="small" 
          onClick={addRow}
          icon={<IconPlus size={14} />}
        >
          Add Row
        </Button>
      </div>
    </div>
  );
}

export default KeyValueTable;