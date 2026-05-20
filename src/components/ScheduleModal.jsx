import { useState } from "react";
import { useModules } from "../context/CollectionContext";
import Modal from "./ui/modal/Modal";
import Input from "./ui/input/Input";
import Button from "./ui/button/Button";
import styles from "./ScheduleModal.module.css";

function ScheduleModal({ onClose }) {
  const { selectedModule, updateSchedule, deleteSchedule } = useModules();
  
  const currentSchedule = selectedModule?.schedule
    ? {
        time: selectedModule.schedule.time || "00:00",
        timezone: selectedModule.schedule.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        active: !!selectedModule.schedule.active
      }
    : {
        time: "00:00",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        active: false
      };


  const [time, setTime] = useState(currentSchedule.time);
  const [timezone, setTimezone] = useState(currentSchedule.timezone);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      await updateSchedule(selectedModule.id, { time, timezone });
      onClose();
    } catch (e) {
      alert("Failed to save schedule");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Deactivate schedule for this module?")) return;
    setLoading(true);
    try {
      await deleteSchedule(selectedModule.id);
      onClose();
    } catch (e) {
      alert("Failed to delete schedule");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Module Schedule" onClose={onClose} size="sm">
      <div className={styles.container}>
        <div className={styles.info}>
          <div className={styles.icon}>⏰</div>
          <p>Schedule your module to run automatically every night.</p>
        </div>

        <div className={styles.form}>
          <Input 
            label="Execution Time (24h)"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          
          <Input 
            label="Timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="e.g. UTC, Asia/Kolkata"
          />
        </div>

        <div className={styles.status}>
          {currentSchedule.active ? (
            <span className={styles.activeTag}>● Active Schedule</span>
          ) : (
            <span className={styles.inactiveTag}>○ No active schedule</span>
          )}
        </div>

        <div className={styles.actions}>
          {currentSchedule.active && (
            <Button variant="danger" ghost onClick={handleDelete} disabled={loading}>
              Deactivate
            </Button>
          )}
          <div className={styles.rightActions}>
            <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Schedule"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default ScheduleModal;
