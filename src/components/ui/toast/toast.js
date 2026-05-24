const listeners = new Set();

export function subscribeToasts(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toast(message, options = {}) {
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    message,
    type: options.type || "success",
    duration: options.duration || 3200,
  };

  listeners.forEach((listener) => listener(item));
  return item.id;
}

toast.success = (message, options) => toast(message, { ...options, type: "success" });
toast.error = (message, options) => toast(message, { ...options, type: "error" });
toast.info = (message, options) => toast(message, { ...options, type: "info" });
