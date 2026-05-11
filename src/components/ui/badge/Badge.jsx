import styles from "./Badge.module.css";

function Badge({ children, variant = "neutral", className = "" }) {
  return (
    <span className={`${styles.badge} ${styles[variant] || styles.neutral} ${className}`}>
      {children}
    </span>
  );
}

export default Badge;
