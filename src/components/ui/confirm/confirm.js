const listeners = new Set();

export function subscribeConfirms(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function confirm(options = {}) {
  return new Promise((resolve) => {
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: options.title || "Are you sure?",
      message: options.message || "",
      confirmLabel: options.confirmLabel || "Confirm",
      cancelLabel: options.cancelLabel || "Cancel",
      variant: options.variant || "danger",
      resolve,
    };
    listeners.forEach((listener) => listener(item));
  });
}
