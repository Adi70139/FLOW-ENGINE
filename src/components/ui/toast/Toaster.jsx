import { useEffect, useState } from "react";
import { subscribeToasts } from "./toast";
import styles from "./Toaster.module.css";

function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    return subscribeToasts((toast) => {
      setItems((current) => [...current, toast]);
      setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== toast.id));
      }, toast.duration);
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <div className={styles.viewport} aria-live="polite" aria-atomic="true">
      {items.map((item) => (
        <div key={item.id} className={`${styles.toast} ${styles[item.type]}`}>
          <span className={styles.dot} />
          <span>{item.message}</span>
        </div>
      ))}
    </div>
  );
}

export default Toaster;
