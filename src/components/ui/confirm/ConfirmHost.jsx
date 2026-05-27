import { useEffect, useState } from "react";
import Modal from "../modal/Modal";
import Button from "../button/Button";
import { subscribeConfirms } from "./confirm";
import styles from "./ConfirmHost.module.css";

function ConfirmHost() {
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    return subscribeConfirms((item) => {
      setCurrent(item);
    });
  }, []);

  if (!current) return null;

  function handleResolve(value) {
    current.resolve(value);
    setCurrent(null);
  }

  return (
    <Modal title={current.title} onClose={() => handleResolve(false)} size="sm">
      <div className={styles.body}>
        {current.message && <p className={styles.message}>{current.message}</p>}
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => handleResolve(false)}>
            {current.cancelLabel}
          </Button>
          <Button
            variant={current.variant === "danger" ? "danger" : "primary"}
            onClick={() => handleResolve(true)}
          >
            {current.confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmHost;
