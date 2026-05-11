import { forwardRef } from "react";
import styles from "./Input.module.css";

const Input = forwardRef(function Input(
  {
    value,
    onChange,
    placeholder,
    type = "text",
    label,
    required,
    icon,
    mono,
    className = "",
    ...rest
  },
  ref
) {
  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={styles.inputWrap}>
        {icon && <span className={styles.iconSlot}>{icon}</span>}
        <input
          ref={ref}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${styles.input} ${icon ? styles.hasIcon : ""} ${mono ? styles.mono : ""}`}
          {...rest}
        />
      </div>
    </div>
  );
});

export default Input;