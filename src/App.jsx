import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { useModules } from "./context/CollectionContext";
import Sidebar from "./components/Sidebar";
import TestList from "./components/TestList";
import RequestEditor from "./components/RequestEditor";
import ResponseViewer from "./components/ResponseViewer";
import CreateFlowModal from "./components/CreateFlowModal";
import CreateStepModal from "./components/CreateStepModal";
import LandingPage from "./components/LandingPage";
import Button from "./components/ui/button/Button";
import EmptyState from "./components/ui/empty-state/EmptyState";
import { IconPlus } from "./components/ui/icons/Icons";
import Navbar from "./components/navbar/Navbar";
import styles from "./App.module.css";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/module/:slug/:moduleId" element={<Workspace />} />
    </Routes>
  );
}

function Workspace() {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const { selectedModule, selectedStep, dispatch, loading, error } = useModules();
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [showCreateTest, setShowCreateTest] = useState(false);

  useEffect(() => {
    if (moduleId) {
      dispatch({ type: "SELECT_MODULE", id: moduleId });
    }
  }, [moduleId, dispatch]);

  if (error) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.app} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState icon="⚠️" title="Connection Error" subtitle={error}>
            <Button onClick={() => window.location.reload()}>Retry Connection</Button>
          </EmptyState>
        </div>
      </div>
    );
  }

  if (loading && !selectedModule) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.app} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className={styles.spinner} style={{ width: 40, height: 40 }} />
          <p style={{ marginTop: 12, opacity: 0.5 }}>Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!selectedModule) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.app} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState
            icon="❓"
            title="Module not found"
            subtitle={`We couldn't find a module with ID "${moduleId}".`}
          >
            <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Navbar />
      
      <div className={styles.app}>
        {/* ── Sidebar (Flows) ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>Flows</h2>
            <Button
              size="small"
              onClick={() => setShowCreateFlow(true)}
              icon={<IconPlus size={14} />}
            >
              Add
            </Button>
          </div>
          <div className={styles.sidebarBody}>
            <Sidebar />
          </div>
        </aside>

        {/* ── Test List Panel ── */}
        <section className={styles.testPanel}>
          <div className={styles.testPanelHeader}>
            <h2>Steps</h2>
            <Button
              size="small"
              onClick={() => setShowCreateTest(true)}
              icon={<IconPlus size={14} />}
            >
              Add
            </Button>
          </div>
          <div className={styles.testPanelBody}>
            <TestList onAddTest={() => setShowCreateTest(true)} />
          </div>
        </section>

        {/* ── Editor Panel ── */}
        <main className={styles.editorPanel}>
          <div className={styles.editorContent}>
            <RequestEditor />
            {selectedStep && (
              <ResponseViewer response={selectedStep.response} />
            )}
            {!selectedStep && (
              <EmptyState
                icon="🚀"
                title="Building your Flow"
                subtitle="Select a step from the left or create a new one to start automating."
              />
            )}
          </div>
        </main>
      </div>

      {/* ── Modals ── */}
      {showCreateFlow && (
        <CreateFlowModal
          onClose={() => setShowCreateFlow(false)}
        />
      )}
      {showCreateTest && (
        <CreateStepModal
          onClose={() => setShowCreateTest(false)}
        />
      )}
    </div>
  );
}

export default App;
