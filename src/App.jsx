import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/navbar/Navbar";
import LandingPage from "./components/LandingPage";
import Sidebar from "./components/Sidebar";
import TestList from "./components/TestList";
import RequestEditor from "./components/RequestEditor";
import ResponseViewer from "./components/ResponseViewer";
import Report from "./components/Report";
import { useModules } from "./context/CollectionContext";
import styles from "./App.module.css";

function ModuleLayout() {
  return (
    <div className={styles.appGrid}>
      <Sidebar />
      <div className={styles.mainArea}>
        <div className={styles.leftPane}>
          <TestList />
        </div>
        <div className={styles.rightPane}>
          <RequestEditor />
          <ResponseViewer />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const { dispatch } = useModules();

  useEffect(() => {
    // Sync URL -> selected module
    const m = location.pathname.match(/^\/module\/[^\/]+\/(\d+)$/);
    if (m) {
      const id = m[1];
      dispatch({ type: "SELECT_MODULE", id });
    }
  }, [location.pathname]);

  return (
    <div>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/module/:slug/:id" element={<ModuleLayout />} />
        <Route path="/report" element={<Report />} />
      </Routes>
    </div>
  );
}