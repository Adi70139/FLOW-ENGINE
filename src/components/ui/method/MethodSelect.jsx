import styles from "./MethodSelect.module.css";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

function MethodSelect({ value = "GET", onChange }) {
  return (
    <div className={styles.methods}>
      {METHODS.map((m) => (
        <button
          key={m}
          className={`${styles.method} ${m === value ? `${styles.active} ${styles[m.toLowerCase()]}` : ""}`}
          onClick={() => onChange(m)}
          type="button"
        >
          {m}
        </button>
      ))}
    </div>
  );
}

export default MethodSelect;
