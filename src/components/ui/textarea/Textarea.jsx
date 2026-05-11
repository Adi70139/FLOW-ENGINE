import styles from "./Textarea.module.css";

function Textarea({ value, onChange, placeholder, rows = 6, label, mono, className = "" }) {
  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}
      <textarea
        className={`${styles.textarea} ${mono ? styles.mono : ""}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );
}

export default Textarea;
