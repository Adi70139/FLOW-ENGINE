import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api, getAuthToken, setAuthToken, onUnauthorized } from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getAuthToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getAuthToken()); // only loading if a token exists
  const hydratedFor = useRef(null);

  // Hydrate the user profile whenever the token changes (and isn't already loaded).
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setUser(null);
      setLoading(false);
      hydratedFor.current = null;
      return;
    }
    if (hydratedFor.current === token && user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .me()
      .then((profile) => {
        if (cancelled) return;
        setUser(profile);
        hydratedFor.current = token;
      })
      .catch(() => {
        if (cancelled) return;
        // Invalid/expired token — wipe and force re-login.
        setAuthToken(null);
        setUser(null);
        setToken(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // React to global 401s / token clears triggered from the api layer.
  useEffect(() => {
    const off = onUnauthorized((next) => {
      setToken(next || null);
    });
    return off;
  }, []);

  // Handle Google OAuth callback: backend redirects to /auth/callback?token=...
  useEffect(() => {
    if (token) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const cbToken = url.searchParams.get("token");
    if (!cbToken) return;
    setAuthToken(cbToken);
    setToken(cbToken);
    // Clean the token out of the URL.
    url.searchParams.delete("token");
    const cleanPath = `${url.pathname}${url.search ? url.search : ""}${url.hash}`;
    window.history.replaceState({}, "", cleanPath || "/");
  }, [token]);

  const login = useCallback(async ({ email, password }) => {
    const res = await api.login({ email, password });
    if (!res?.token) throw new Error("Login did not return a token");
    setAuthToken(res.token);
    setUser(res.user || null);
    setToken(res.token);
    hydratedFor.current = res.token;
    return res;
  }, []);

  const register = useCallback(async ({ email, name, password }) => {
    const res = await api.register({ email, name, password });
    if (!res?.token) throw new Error("Register did not return a token");
    setAuthToken(res.token);
    setUser(res.user || null);
    setToken(res.token);
    hydratedFor.current = res.token;
    return res;
  }, []);

  const loginWithGoogle = useCallback(async (redirectTo) => {
    const res = await api.googleLoginUrl(redirectTo);
    const url = res?.url || res?.authorizationUrl || (typeof res === "string" ? res : null);
    if (!url) throw new Error("Backend did not return a Google login URL");
    window.location.assign(url);
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    setToken(null);
    hydratedFor.current = null;
  }, []);

  const value = {
    token,
    user,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    logout,
    loginWithGoogle,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}
