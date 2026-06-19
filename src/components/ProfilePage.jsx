import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../utils/api";
import { toast } from "./ui/toast/toast";
import styles from "./ProfilePage.module.css";
import { useNavigate } from "react-router-dom";
import Button from "./ui/button/Button";
import { IconModule, IconReport } from "./ui/icons/Icons";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState(user?.name || "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  const [showWarning, setShowWarning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
    }
  }, [user]);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const data = await api.getDashboard();
        setDashboardData(data);
      } catch (err) {
        toast.error("Failed to load dashboard data");
      } finally {
        setLoadingDashboard(false);
      }
    }
    fetchDashboard();
  }, []);

  async function handleUpdateProfile(e) {
    e.preventDefault();
    if (!name.trim()) return;
    
    setSubmitting(true);
    try {
      await api.updateProfile({ 
        name: name.trim(),
        ...(password ? { password } : {})
      });
      toast.success("Profile updated successfully");
      setPassword("");
      // The context may automatically fetch the new name or we could update it locally.
      // But it's fine for now, next reload will get it.
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

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        
        {/* Profile Editing Section */}
        <div className={`${styles.card} ${styles.profileCard}`}>
          <h2 className={styles.heading}>Your Profile</h2>
          <p className={styles.subheading}>Update your account information.</p>
          
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
              <label className={styles.label}>Name</label>
              <input
                className={styles.input}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            
            <div className={styles.field}>
              <label className={styles.label}>Set New Password</label>
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
                disabled={submitting}
              />
            </div>

            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? "Updating..." : "Save Changes"}
            </button>
          </form>
        </div>

        {/* Dashboard / History Section */}
        <div className={`${styles.card} ${styles.dashboardCard}`}>
          <h2 className={styles.heading}>Dashboard History</h2>
          <p className={styles.subheading}>Recent activities and modules you've created.</p>
          
          {loadingDashboard ? (
            <div className={styles.loading}>Loading dashboard...</div>
          ) : (
            <div className={styles.dashboard}>
              <div className={styles.statBox}>
                <div className={styles.statValue}>{dashboardData?.modules?.length || 0}</div>
                <div className={styles.statLabel}>Modules Created</div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statValue}>
                  {dashboardData?.modules?.reduce((acc, mod) => acc + (mod.flowCount || 0), 0) || 0}
                </div>
                <div className={styles.statLabel}>Total Flows</div>
              </div>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className={styles.dangerCard}>
          <h2 className={styles.dangerHeading}>Danger Zone</h2>
          <p className={styles.subheading}>Permanently delete your account and all associated data.</p>
          
          {showWarning ? (
            <div className={styles.warningBox}>
              <p><strong>Are you absolutely sure?</strong></p>
              <p>This will delete your account, and permanently wipe all modules, flows, and work you have created. This action cannot be undone.</p>
              <div className={styles.warningActions}>
                <button 
                  className={styles.dangerBtn} 
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Yes, Delete Everything"}
                </button>
                <button 
                  className={styles.secondaryBtn} 
                  onClick={() => setShowWarning(false)}
                  disabled={deleting}
                >
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
    </div>
  );
}
