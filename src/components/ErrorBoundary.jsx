import React from "react";
import styles from "./ErrorBoundary.module.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container}>
          <div className={styles.content}>
            <h1>Oops! Something went wrong.</h1>
            <p>The application crashed. This usually happens due to unexpected data from the API.</p>
            <pre className={styles.error}>{this.state.error?.toString()}</pre>
            <button onClick={() => window.location.href = "/"}>Back to Home</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
