import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useModules } from "../../context/CollectionContext";
import Button from "../ui/button/Button";
import { IconModule, IconBack, IconSchedule, IconPlus, IconReport } from "../ui/icons/Icons";
import EnvironmentModal from "../EnvironmentModal";
import ScheduleModal from "../ScheduleModal";
import styles from "./Navbar.module.css";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedModule, selectedEnvId, dispatch } = useModules();
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const isHomePage = location.pathname === "/";
  const isModulePage = location.pathname.startsWith("/module/");
  const environments = selectedModule?.environments || [];

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
              <button className={styles.iconBtn} onClick={() => setShowEnvModal(true)} title="Manage Environments">
                <IconPlus size={14} />
              </button>
            </div>

            <button className={styles.iconBtn} onClick={() => setShowScheduleModal(true)} title="Module Schedule">
              <IconSchedule size={18} />
            </button>

            <button className={styles.iconBtn} onClick={() => navigate("/report")} title="Reports">
              <IconReport size={18} />
            </button>

            <button className={styles.iconBtn} onClick={() => navigate("/report?type=schedule")} title="Automation Analytics">
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
      </div>

      {showEnvModal && <EnvironmentModal onClose={() => setShowEnvModal(false)} />}
      {showScheduleModal && <ScheduleModal onClose={() => setShowScheduleModal(false)} />}
    </nav>
  );
}

export default Navbar;
