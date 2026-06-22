import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "./ui/toast/toast";
import { IconModule } from "./ui/icons/Icons";
import styles from "./AuthPage.module.css";

function GoogleIcon() {
  return (
    <svg className={styles.googleIcon} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29 35.6 26.6 36.5 24 36.5c-5.3 0-9.7-3.4-11.3-8L6.2 33.3C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41 35.4 44 30.1 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export default function AuthPage() {
  const { login, register, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  function switchMode(next) {
    setMode(next);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Name is required to register.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login({ email: email.trim(), password });
        toast.success("Welcome back!");
      } else {
        await register({ email: email.trim(), name: name.trim(), password });
        toast.success("Account created.");
      }
    } catch (err) {
      setError(err?.message || "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err?.message || "Google sign-in failed.");
      setGoogleLoading(false);
    }
  }

  const isLogin = mode === "login";
  const busy = submitting || googleLoading;

  return (
    <div className={styles.wrapper}>
      {/* Decorative Blobs */}
      <div className={styles.blob1} />
      <div className={styles.blob2} />
      <div className={styles.blob3} />

      <div className={styles.container}>
        {/* Left Side: Brand Panel */}
        <div className={styles.brandPanel}>
          <div className={styles.logoArea}>
            <div className={styles.logoIconBg}>
              <IconModule size={32} className={styles.logoIcon} />
            </div>
            <span className={styles.brandTitle}>Flow Engine</span>
          </div>

          <div className={styles.brandContent}>
            <h2 className={styles.brandHeading}>
              Orchestrate & Automate <span className={styles.accentText}>Effortlessly</span>
            </h2>
            <p className={styles.brandDescription}>
              Design, parameterize, and run API workflows with a beautiful, high-performance visual runner.
            </p>

            <ul className={styles.featureList}>
              <li className={styles.featureItem}>
                <span className={styles.checkIcon}>✓</span>
                <span>Visual Flow Customization</span>
              </li>
              <li className={styles.featureItem}>
                <span className={styles.checkIcon}>✓</span>
                <span>Interactive Execution Dashboard</span>
              </li>
              <li className={styles.featureItem}>
                <span className={styles.checkIcon}>✓</span>
                <span>Custom Method Builder</span>
              </li>
            </ul>
          </div>

          <div className={styles.brandFooter}>
            © {new Date().getFullYear()} Flow Engine. All rights reserved.
          </div>
        </div>

        {/* Right Side: Auth Card Form */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.heading}>
              {isLogin ? "Welcome back" : "Get started"}
            </h1>
            <p className={styles.subheading}>
              {isLogin
                ? "Enter your details to access your dashboard"
                : "Create an account to start building flows"}
            </p>
          </div>

          <div className={styles.tabs} role="tablist" aria-label="Auth mode">
            <button
              type="button"
              role="tab"
              aria-selected={isLogin}
              className={`${styles.tab} ${isLogin ? styles.tabActive : ""}`}
              onClick={() => switchMode("login")}
              disabled={busy}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isLogin}
              className={`${styles.tab} ${!isLogin ? styles.tabActive : ""}`}
              onClick={() => switchMode("register")}
              disabled={busy}
            >
              Register
            </button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {!isLogin && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="auth-name">Name</label>
                <input
                  id="auth-name"
                  className={styles.input}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Jane Doe"
                  disabled={busy}
                  required
                />
              </div>
            )}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="auth-email">Email Address</label>
              <input
                id="auth-email"
                className={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                disabled={busy}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="auth-password">Password</label>
              <div className={styles.passwordWrap}>
                <input
                  id="auth-password"
                  className={styles.input}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  placeholder="••••••••"
                  disabled={busy}
                  required
                  minLength={isLogin ? undefined : 6}
                />
                <button
                  type="button"
                  className={styles.togglePwBtn}
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={busy}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && <div className={styles.error} role="alert">{error}</div>}

            <button type="submit" className={styles.primaryBtn} disabled={busy}>
              {submitting
                ? (isLogin ? "Signing in…" : "Creating account…")
                : (isLogin ? "Sign in" : "Create account")}
            </button>
          </form>

          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span>or</span>
            <span className={styles.dividerLine} />
          </div>

          <button
            type="button"
            className={styles.googleBtn}
            onClick={handleGoogle}
            disabled={busy}
          >
            <GoogleIcon />
            {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
          </button>

          <p className={styles.footer}>
            {isLogin ? (
              <>
                Don't have an account?{" "}
                <button type="button" onClick={() => switchMode("register")} disabled={busy}>
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button type="button" onClick={() => switchMode("login")} disabled={busy}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
