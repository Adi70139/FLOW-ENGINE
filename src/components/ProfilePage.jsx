import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../utils/api";
import { toast } from "./ui/toast/toast";
import styles from "./ProfilePage.module.css";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [modules, setModules] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  const [showWarning, setShowWarning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) setName(user.name || "");
  }, [user]);

  useEffect(() => {
    api.getModules()
      .then(setModules)
      .catch(() => toast.error("Failed to load modules"))
      .finally(() => setLoadingDashboard(false));
  }, []);

  async function handleUpdateProfile(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await api.updateProfile({
        name: name.trim(),
        ...(password ? { password } : {}),
      });
      toast.success("Profile updated");
      setPassword("");
    } catch (err) {
      toast.error(err?.message || "Failed to update profile");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await api.deleteAccount();
      toast.success("Account deleted");
      logout();
      navigate("/");
    } catch (err) {
      toast.error(err?.message || "Failed to delete account");
      setDeleting(false);
    }
  }

  if (!user) return null;

  const totalFlows = modules.reduce((acc, m) => acc + (m.flowCount || 0), 0);

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>

        {/* Left column */}
        <div className={styles.leftCol}>

          {/* Profile Card */}
          <div className={styles.card}>
            {/* Avatar */}
            <div className={styles.avatarRow}>
              <div className={styles.avatar}>
                {(user.name || user.email || "?")[0].toUpperCase()}
              </div>
              <div>
                <div className={styles.avatarName}>{user.name}</div>
                <div className={styles.avatarEmail}>{user.email}</div>
              </div>
            </div>

            <div className={styles.divider} />

            <form className={styles.form} onSubmit={handleUpdateProfile}>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input
                  className={styles.input}
                  type="email"
                  value={user.email}
                  disabled
                />
                <span className={styles.hint}>Email cannot be changed</span>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Display Name</label>
                <input
                  className={styles.input}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="Your name"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>New Password</label>
                <input
                  className={styles.input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  disabled={submitting}
                />
              </div>

              <button type="submit" className={styles.primaryBtn} disabled={submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>

          {/* Danger Zone */}
          <div className={styles.dangerCard}>
            <h2 className={styles.dangerHeading}>Danger Zone</h2>
            <p className={styles.subheading}>Permanently delete your account and all data.</p>

            {showWarning ? (
              <div className={styles.warningBox}>
                <p><strong>Are you absolutely sure?</strong></p>
                <p>This will delete your account and permanently wipe all modules, flows, and work you have created. This cannot be undone.</p>
                <div className={styles.warningActions}>
                  <button className={styles.dangerBtn} onClick={handleDeleteAccount} disabled={deleting}>
                    {deleting ? "Deleting..." : "Yes, Delete Everything"}
                  </button>
                  <button className={styles.secondaryBtn} onClick={() => setShowWarning(false)} disabled={deleting}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button className={styles.dangerBtn} onClick={() => setShowWarning(true)}>
                Delete Account
              </button>
            )}
          </div>
        </div>

        {/* Right column — Dashboard */}
        <div className={styles.card}>
          <h2 className={styles.heading}>My Dashboard</h2>
          <p className={styles.subheading}>Your modules and flows at a glance.</p>

          {/* Stats row */}
          <div className={styles.statsRow}>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{loadingDashboard ? "—" : modules.length}</div>
              <div className={styles.statLabel}>Modules</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{loadingDashboard ? "—" : totalFlows}</div>
              <div className={styles.statLabel}>Total Flows</div>
            </div>
          </div>

          {/* Module list */}
          <div className={styles.moduleListHeader}>Your Modules</div>
          {loadingDashboard ? (
            <div className={styles.emptyState}>Loading...</div>
          ) : modules.length === 0 ? (
            <div className={styles.emptyState}>No modules created yet.</div>
          ) : (
            <div className={styles.moduleList}>
              {modules.map((mod) => (
                <div key={mod.id} className={styles.moduleItem}>
                  <div className={styles.moduleIcon}>M</div>
                  <div className={styles.moduleDetails}>
                    <div className={styles.moduleName}>{mod.name}</div>
                    {mod.description && (
                      <div className={styles.moduleDesc}>{mod.description}</div>
                    )}
                  </div>
                  <div className={styles.moduleFlowBadge}>
                    {mod.flowCount} {mod.flowCount === 1 ? "flow" : "flows"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
