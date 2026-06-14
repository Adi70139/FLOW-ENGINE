import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useModules } from "../../context/CollectionContext";
import { useAuth } from "../../context/AuthContext";
import Button from "../ui/button/Button";
import { IconModule, IconBack, IconSchedule, IconPlus, IconReport } from "../ui/icons/Icons";
import EnvironmentModal from "../EnvironmentModal";
import ScheduleModal from "../ScheduleModal";
import styles from "./Navbar.module.css";

function getInitials(name, email) {
  const source = (name || email || "").trim();
  if (!source) return "?";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedModule, selectedEnvId, dispatch } = useModules();
  const { user, logout, isAuthenticated } = useAuth();
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  const isHomePage = location.pathname === "/";
  const isModulePage = location.pathname.startsWith("/module/");
  const environments = selectedModule?.environments || [];

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate("/", { replace: true });
  }

  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        <div className={styles.logo} onClick={() => navigate("/")}>
          <IconModule size={24} className={styles.logoIcon} />
          <span className={styles.logoText}>Flow Engine</span>
        </div>
        {isModulePage && selectedModule && (
          <div className={styles.breadcrumb}>
            <span className={styles.separator}>/</span>
            <span className={styles.moduleName}>{selectedModule.name}</span>
          </div>
        )}
      </div>
      
      <div className={styles.right}>
        {isModulePage && selectedModule && (
          <div className={styles.controls}>
            <div className={styles.envSelector}>
              <span className={styles.envLabel}>Env:</span>
              <select 
                className={styles.select}
                value={selectedEnvId || ""}
                onChange={(e) => dispatch({ type: "SELECT_ENV", id: e.target.value })}
              >
                <option value="">No Environment</option>
                {environments.map(env => (
                  <option key={env.id} value={env.id}>{env.name}</option>
                ))}
              </select>
              <button className={styles.iconBtn} onClick={() => setShowEnvModal(true)} data-tooltip="Manage Environments" aria-label="Manage Environments">
                <IconPlus size={14} />
              </button>
            </div>

            <button className={styles.iconBtn} onClick={() => setShowScheduleModal(true)} data-tooltip="Module Schedule" aria-label="Module Schedule">
              <IconSchedule size={18} />
            </button>

            <button className={styles.iconBtn} onClick={() => navigate("/report")} data-tooltip="Reports" aria-label="Reports">
              <IconReport size={18} />
            </button>

            <div className={styles.divider} />
          </div>
        )}

        {!isHomePage && (
          <Button
            variant="secondary"
            size="small"
            onClick={() => navigate("/")}
            icon={<IconBack size={16} />}
          >
            Dashboard
          </Button>
        )}

        {isAuthenticated && user && (
          <div className={styles.userMenu} ref={menuRef}>
            <button
              type="button"
              className={styles.avatarBtn}
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
            >
              <span className={styles.avatar}>{getInitials(user.name, user.email)}</span>
            </button>
            {menuOpen && (
              <div className={styles.userMenuPanel} role="menu">
                <div className={styles.userMenuHeader}>
                  <div className={styles.userMenuName}>{user.name || "—"}</div>
                  <div className={styles.userMenuEmail}>{user.email}</div>
                  <div className={styles.userMenuMeta}>
                    {user.role && <span className={styles.tag}>{user.role}</span>}
                    {user.provider && <span className={styles.tag}>{user.provider}</span>}
                  </div>
                </div>
                <div className={styles.userMenuDivider} />
                <button
                  type="button"
                  role="menuitem"
                  className={styles.userMenuItem}
                  onClick={handleLogout}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showEnvModal && <EnvironmentModal onClose={() => setShowEnvModal(false)} />}
      {showScheduleModal && <ScheduleModal onClose={() => setShowScheduleModal(false)} />}
    </nav>
  );
}

export default Navbar;
