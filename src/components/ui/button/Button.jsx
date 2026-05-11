import styles from "./Button.module.css";

function Button({
  children,
  variant = "primary",
  size = "medium",
  disabled = false,
  fullWidth = false,
  type = "button",
  icon,
  onClick,
  className = "",
  ...rest
}) {
  const classNames = [
    styles.button,
    styles[variant] || "",
    styles[size] || "",
    fullWidth ? styles.fullWidth : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={classNames}
      {...rest}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      {children}
    </button>
  );
}

export default Button;