import styles from "./IconButton.module.css";

function IconButton({ children, onClick, title, size, variant, className = "", ...rest }) {
  const cls = [
    styles.iconButton,
    styles[size] || "",
    styles[variant] || "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      title={title}
      aria-label={title}
      {...rest}
    >
      {children}
    </button>
  );
}

export default IconButton;
