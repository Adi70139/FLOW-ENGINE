import { useNavigate } from "react-router-dom";
import { useModules } from "../../context/CollectionContext";
import Button from "../ui/button/Button";
import { IconModule, IconBack } from "../ui/icons/Icons";
import styles from "./Navbar.module.css";

function Navbar() {
  const navigate = useNavigate();
  const { selectedModule } = useModules();

  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        <div className={styles.logo} onClick={() => navigate("/")}>
          <IconModule size={24} className={styles.logoIcon} />
          <span className={styles.logoText}>MrAutomation</span>
        </div>
        {selectedModule && (
          <div className={styles.breadcrumb}>
            <span className={styles.separator}>/</span>
            <span className={styles.moduleName}>{selectedModule.name}</span>
          </div>
        )}
      </div>
      
      <div className={styles.right}>
        <Button 
          variant="secondary" 
          size="small" 
          onClick={() => navigate("/")}
          icon={<IconBack size={16} />}
        >
          Dashboard
        </Button>
      </div>
    </nav>
  );
}

export default Navbar;
