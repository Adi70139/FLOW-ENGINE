import { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.css";

function Modal({ title, children, onClose, size }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Prevent scrolling on the body while modal is open
    document.body.style.overflow = "hidden";
    
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "unset";
    };
  }, [onClose]);

  const sizeClass = size === "xl" ? styles.xl : size === "lg" ? styles.lg : size === "sm" ? styles.sm : "";

  const modalContent = (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={`${styles.modal} ${sizeClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3>{title}</h3>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default Modal;
