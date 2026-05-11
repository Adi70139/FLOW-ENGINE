import styles from "./Tabs.module.css";

function Tabs({ tabs = [], activeTab, onChange }) {
  return (
    <div className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`${styles.tab} ${activeTab === tab.id ? styles.active : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <span className={styles.tabIcon}>{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
