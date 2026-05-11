import styles from "./EmptyState.module.css";

function EmptyState({ icon, title, subtitle, children }) {
  return (
    <div className={styles.container}>
      {icon && <div className={styles.icon}>{icon}</div>}
      {title && <div className={styles.title}>{title}</div>}
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      {children}
    </div>
  );
}

export default EmptyState;
