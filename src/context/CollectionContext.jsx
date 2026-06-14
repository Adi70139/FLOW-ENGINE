import { createContext, useContext, useReducer, useEffect, useRef } from "react";
import { api, mapStepToTest, normalizeSchedule } from "../utils/api";
import { toast } from "../components/ui/toast/toast";
import { useAuth } from "./AuthContext";

const ModuleContext = createContext(null);

const initialState = {
  modules: [],
  selectedModuleId: null,
  selectedFlowId: null,
  selectedStepId: null,
  selectedEnvId: null,
  loading: false,
  error: null,
  executions: {}, // { [id]: { status, results, type, startedAt, finishedAt } }
};

const scheduleStorageKey = (moduleId) => `mr_auto_module_schedule_${moduleId}`;

function readCachedSchedule(moduleId) {
  try {
    return normalizeSchedule(JSON.parse(localStorage.getItem(scheduleStorageKey(moduleId))));
  } catch (e) {
    console.warn("Failed to read cached schedule:", e);
    return null;
  }
}

function writeCachedSchedule(moduleId, schedule) {
  try {
    if (schedule) {
      localStorage.setItem(scheduleStorageKey(moduleId), JSON.stringify(normalizeSchedule(schedule)));
    } else {
      localStorage.removeItem(scheduleStorageKey(moduleId));
    }
  } catch (e) {
    console.warn("Failed to persist schedule cache:", e);
  }
}

function reducer(state, action) {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.error };
    case "SET_STATE":
      return { ...state, ...action.payload, loading: false };

    case "ADD_MODULE":
      return { ...state, modules: [...state.modules, action.module], loading: false };

    case "DELETE_MODULE": {
      const next = state.modules.filter((m) => m.id != action.id);
      return {
        ...state,
        modules: next,
        selectedModuleId: state.selectedModuleId == action.id ? null : state.selectedModuleId,
      };
    }

    case "UPDATE_MODULE":
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id == action.id ? { ...m, ...action.patch } : m
        ),
      };

    case "SELECT_MODULE":
      return {
        ...state,
        selectedModuleId: action.id,
        selectedFlowId: null,
        selectedStepId: null,
        selectedEnvId: null,
      };

    case "SET_FLOWS":
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id == action.moduleId
            ? {
              ...m,
              flows: (action.flows || []).map((f) => ({
                ...f,
                tests: null,
                stepsLoaded: false,
              })),
              flowsLoaded: true,
            }
            : m
        ),
      };

    case "ADD_FLOW":
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id == action.moduleId
            ? { ...m, flows: [...(m.flows || []), { ...action.flow, tests: [] }] }
            : m
        ),
        selectedFlowId: action.flow.id,
        selectedStepId: null,
        loading: false,
      };

    case "DELETE_FLOW":
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id == action.moduleId
            ? { ...m, flows: (m.flows || []).filter((f) => f.id != action.id) }
            : m
        ),
        selectedFlowId: state.selectedFlowId == action.id ? null : state.selectedFlowId,
      };

    case "UPDATE_FLOW":
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id == action.moduleId
            ? {
              ...m,
              flows: (m.flows || []).map((f) =>
                f.id == action.id ? { ...f, ...action.patch } : f
              ),
            }
            : m
        ),
      };

    case "SELECT_FLOW":
      return { ...state, selectedFlowId: action.id, selectedStepId: null };

    case "SET_STEPS":
      return {
        ...state,
        modules: state.modules.map((m) => ({
          ...m,
          flows: (m.flows || []).map((f) =>
            f.id == action.flowId
              ? { ...f, tests: action.steps, stepsLoaded: true }
              : f
          ),
        })),
        selectedStepId: action.steps?.[0]?.id || null,
      };

    case "ADD_STEP":
      return {
        ...state,
        modules: state.modules.map((m) => ({
          ...m,
          flows: (m.flows || []).map((f) =>
            f.id == action.flowId
              ? { ...f, tests: [...(f.tests || []), action.step], stepsLoaded: true }
              : f
          ),
        })),
        selectedStepId: action.step.id,
        loading: false,
      };

    case "UPDATE_STEP":
      if (action.patch && action.patch.response) {
        try {
          localStorage.setItem(
            `mr_auto_step_response_${action.stepId}`,
            JSON.stringify(action.patch.response)
          );
        } catch (e) {
          console.warn("Failed to save response to localStorage:", e);
        }
      }
      return {
        ...state,
        modules: state.modules.map((m) => ({
          ...m,
          flows: (m.flows || []).map((f) =>
            f.id == action.flowId
              ? {
                ...f,
                tests: (f.tests || []).map((t) =>
                  t.id == action.stepId ? { ...t, ...action.patch } : t
                ),
              }
              : f
          ),
        })),
      };

    case "REORDER_TESTS":
      return {
        ...state,
        modules: state.modules.map((m) => ({
          ...m,
          flows: (m.flows || []).map((f) =>
            f.id == action.flowId
              ? { ...f, tests: action.tests }
              : f
          ),
        })),
      };

    case "DELETE_STEP":
      return {
        ...state,
        modules: state.modules.map((m) => ({
          ...m,
          flows: (m.flows || []).map((f) =>
            f.id == action.flowId
              ? { ...f, tests: (f.tests || []).filter((t) => t.id != action.stepId) }
              : f
          ),
        })),
        selectedStepId:
          state.selectedStepId == action.stepId ? null : state.selectedStepId,
      };

    case "SELECT_STEP":
      return { ...state, selectedStepId: action.id };

    case "SELECT_ENV":
      return { ...state, selectedEnvId: action.id };

    case "SET_ENVIRONMENTS":
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id == action.moduleId
            ? { ...m, environments: action.environments, envLoaded: true }
            : m
        ),
      };

    case "SET_SCHEDULE": {
      writeCachedSchedule(action.moduleId, action.schedule);
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id == action.moduleId
            ? { ...m, schedule: normalizeSchedule(action.schedule), scheduleLoaded: true }
            : m
        ),
      };
    }

    case "EXECUTION_START":
      return {
        ...state,
        executions: {
          ...state.executions,
          [action.id]: {
            status: "running",
            type: action.execType,
            total: action.total || 0,
            startedAt: new Date().toISOString(),
          },
        },
      };

    case "EXECUTION_POLLING":
      return {
        ...state,
        executions: {
          ...state.executions,
          [action.id]: {
            ...state.executions[action.id],
            pollData: action.pollData,
          },
        },
      };

    case "EXECUTION_END": {
      const execResult = {
        id: action.id,
        status: "done",
        results: action.results,
        type: action.execType,
        finishedAt: new Date().toISOString(),
      };
      const nextExecutions = { ...state.executions, [action.id]: execResult };

      // Persist last 50 executions in localStorage history — avoid duplicates
      try {
        const history = JSON.parse(localStorage.getItem("mr_auto_history") || "[]");
        // Use a unique key for matching: type + id + (optional results specific ID)
        const getUniqueId = (item) => {
          const resId = item.results?.jobId || item.results?.bulkJobId || item.results?.moduleExecutionId || item.results?.flowExecutionId;
          return `${item.type}-${item.id}-${resId || ""}`;
        };
        const currentUniqueId = getUniqueId(execResult);

        // Remove existing if it's the same run (unlikely but safe) or if we just want the latest
        const filtered = history.filter(h => getUniqueId(h) !== currentUniqueId);
        const newHistory = [execResult, ...filtered].slice(0, 50);
        localStorage.setItem("mr_auto_history", JSON.stringify(newHistory));
      } catch (e) {
        console.error("Failed to save history:", e);
      }

      return { ...state, executions: nextExecutions };
    }

    default:
      return state;
  }
}

export function ModuleProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pollingTimers = useRef({});
  const { token, isAuthenticated } = useAuth();

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !isAuthenticated) return;
    async function load() {
      dispatch({ type: "FETCH_START" });
      try {
        const modulesData = await api.getModules();

        // Pre-fetch flows for all modules in parallel for "Total Flow Count" and instant navigation
        const modulesWithFlows = await Promise.all(
          modulesData.map(async (m) => {
            try {
              const [flows, envs] = await Promise.all([
                api.getFlowsByModule(m.name),
                api.getModuleEnvironments(m.id)
              ]);
              return {
                ...m,
                flows: flows.map(f => ({ ...f, tests: null, stepsLoaded: false })),
                flowsLoaded: true,
                environments: envs || [],
                envLoaded: true,
                schedule: normalizeSchedule(m.schedule) || readCachedSchedule(m.id),
                scheduleLoaded: false,
              };
            } catch {
              return {
                ...m,
                flows: null,
                flowsLoaded: false,
                environments: [],
                envLoaded: false,
                schedule: normalizeSchedule(m.schedule) || readCachedSchedule(m.id),
                scheduleLoaded: false,
              };
            }
          })
        );

        modulesWithFlows.forEach((module) => {
          api
            .getModuleSchedule(module.id)
            .then((schedule) => {
              dispatch({ type: "SET_SCHEDULE", moduleId: module.id, schedule });
            })
            .catch(() => {
              if (!module.schedule) {
                dispatch({ type: "SET_SCHEDULE", moduleId: module.id, schedule: null });
              }
            });
        });

        dispatch({
          type: "SET_STATE",
          payload: {
            modules: modulesWithFlows,
          },
        });
      } catch (error) {
        dispatch({ type: "FETCH_ERROR", error: error.message });
      }
    }
    load();
  }, [token, isAuthenticated]);

  // ── Load flows, environments & schedule when module is selected ───────────
  useEffect(() => {
    if (!state.selectedModuleId) return;
    const mod = state.modules.find((m) => m.id == state.selectedModuleId);
    if (!mod) return;

    async function loadModuleData() {
      if (!mod.flowsLoaded) {
        try {
          const flows = await api.getFlowsByModule(mod.name);
          dispatch({ type: "SET_FLOWS", moduleId: mod.id, flows });
        } catch (e) {
          console.error("Failed to load flows:", e);
        }
      }
      if (!mod.envLoaded) {
        try {
          const envs = await api.getModuleEnvironments(mod.id);
          dispatch({ type: "SET_ENVIRONMENTS", moduleId: mod.id, environments: envs });
        } catch (e) {
          console.error("Failed to load environments:", e);
        }
      }
      if (!mod.scheduleLoaded) {
        try {
          const schedule = await api.getModuleSchedule(mod.id);
          dispatch({ type: "SET_SCHEDULE", moduleId: mod.id, schedule });
        } catch {
          // 404 is expected when no schedule is set — mark as loaded anyway
          dispatch({ type: "SET_SCHEDULE", moduleId: mod.id, schedule: null });
        }
      }
    }
    loadModuleData();
  }, [state.selectedModuleId, state.modules]);

  // ── Load steps when flow is selected ─────────────────────────────────────
  useEffect(() => {
    if (!state.selectedFlowId) return;
    const mod = state.modules.find((m) => m.id == state.selectedModuleId);
    const flow = mod?.flows?.find((f) => f.id == state.selectedFlowId);
    if (flow && !flow.stepsLoaded) {
      api
        .getSteps(state.selectedFlowId)
        .then((steps) => {
          dispatch({
            type: "SET_STEPS",
            flowId: state.selectedFlowId,
            steps: steps.map(mapStepToTest),
          });
        })
        .catch((e) => console.error("Failed to load steps:", e));
    }
  }, [state.selectedFlowId, state.selectedModuleId, state.modules]);

  return (
    <ModuleContext.Provider value={{ state, dispatch, pollingTimers }}>
      {children}
    </ModuleContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useModules() {
  const ctx = useContext(ModuleContext);
  if (!ctx) throw new Error("useModules must be used within ModuleProvider");

  const { state, dispatch, pollingTimers } = ctx;
  const modules = state?.modules || [];

  const selectedModule = modules.find((m) => m.id == state.selectedModuleId);
  const selectedFlow = selectedModule?.flows?.find((f) => f.id == state.selectedFlowId);
  const selectedStep = selectedFlow?.tests?.find((t) => t.id == state.selectedStepId);
  const selectedEnv = selectedModule?.environments?.find((e) => e.id == state.selectedEnvId);

  // ── Module methods ────────────────────────────────────────────────────────

  const addModule = async (name, description) => {
    dispatch({ type: "FETCH_START" });
    try {
      const newMod = await api.createModule({ name, description });
      dispatch({
        type: "ADD_MODULE",
        module: { ...newMod, flows: [], environments: [], schedule: null },
      });
      toast.success("Module created");
      return newMod;
    } catch (error) {
      dispatch({ type: "FETCH_ERROR", error: error.message });
      toast.error(error.message || "Failed to create module");
      throw error;
    }
  };

  /** FIX: updateModule was called in LandingPage but missing from context + original api.js */
  const updateModule = async (id, data) => {
    try {
      const updated = await api.updateModule(id, data);
      dispatch({ type: "UPDATE_MODULE", id, patch: data });
      toast.success("Module updated");
      return updated;
    } catch (error) {
      console.error("Failed to update module:", error);
      toast.error(error.message || "Failed to update module");
      throw error;
    }
  };

  const deleteModule = async (id) => {
    try {
      await api.deleteModule(id);
      dispatch({ type: "DELETE_MODULE", id });
      toast.success("Module deleted");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to delete module");
    }
  };

  // ── Environment methods ───────────────────────────────────────────────────

  const addEnvironment = async (moduleId, data) => {
    try {
      const newEnv = await api.createEnvironment(moduleId, data);
      const envs = [...(selectedModule?.environments || []), newEnv];
      dispatch({ type: "SET_ENVIRONMENTS", moduleId, environments: envs });
      toast.success("Environment created");
      return newEnv;
    } catch (error) {
      console.error("Failed to add environment:", error);
      toast.error(error.message || "Failed to create environment");
      throw error;
    }
  };

  const updateEnvironment = async (moduleId, envId, data) => {
    try {
      const updated = await api.updateEnvironment(moduleId, envId, data);
      const envs = (selectedModule?.environments || []).map((e) =>
        e.id == envId ? updated : e
      );
      dispatch({ type: "SET_ENVIRONMENTS", moduleId, environments: envs });
      toast.success("Environment updated");
    } catch (error) {
      console.error("Failed to update environment:", error);
      toast.error(error.message || "Failed to update environment");
      throw error;
    }
  };

  /** FIX: deleteEnvironment was used in EnvironmentModal but missing from useModules() return */
  const deleteEnvironment = async (moduleId, envId) => {
    try {
      await api.deleteEnvironment(moduleId, envId);
      const envs = (selectedModule?.environments || []).filter((e) => e.id != envId);
      dispatch({ type: "SET_ENVIRONMENTS", moduleId, environments: envs });
      toast.success("Environment deleted");
    } catch (error) {
      console.error("Failed to delete environment:", error);
      toast.error(error.message || "Failed to delete environment");
      throw error;
    }
  };

  // ── Schedule methods ──────────────────────────────────────────────────────

  const updateSchedule = async (moduleId, data) => {
    try {
      const schedule = await api.setModuleSchedule(moduleId, data);
      dispatch({ type: "SET_SCHEDULE", moduleId, schedule });
      toast.success("Schedule saved");
    } catch (error) {
      console.error("Failed to update schedule:", error);
      toast.error(error.message || "Failed to save schedule");
      throw error;
    }
  };

  const deleteSchedule = async (moduleId) => {
    try {
      await api.deleteModuleSchedule(moduleId);
      dispatch({ type: "SET_SCHEDULE", moduleId, schedule: null });
      toast.success("Schedule deactivated");
    } catch (error) {
      console.error("Failed to delete schedule:", error);
      toast.error(error.message || "Failed to deactivate schedule");
      throw error;
    }
  };

  // ── Flow methods ──────────────────────────────────────────────────────────

  const addFlow = async (moduleId, name, description, environmentId) => {
    const mod = modules.find((m) => m.id == moduleId);
    if (!mod) return;
    try {
      const newFlow = await api.createFlow({ name, description, environmentId }, mod.name);
      dispatch({ type: "ADD_FLOW", moduleId: mod.id, flow: newFlow });
      toast.success("Flow created");
      return newFlow;
    } catch (error) {
      console.error("Failed to create flow:", error);
      toast.error(error.message || "Failed to create flow");
      throw error;
    }
  };

  const importFlow = async (moduleId, file, flowName, importType = "postman") => {
    dispatch({ type: "FETCH_START" });
    try {
      const apiMethod =
        importType === "swagger"
          ? api.importSwagger
          : importType === "har"
          ? api.importHar
          : api.importPostman;
      const newFlow = await apiMethod(file, flowName, moduleId);
      dispatch({ type: "ADD_FLOW", moduleId, flow: newFlow });
      toast.success("Flow imported");
      return newFlow;
    } catch (error) {
      dispatch({ type: "FETCH_ERROR", error: error.message });
      toast.error(error.message || "Import failed");
      throw error;
    }
  };

  /** FIX: updateFlow was missing from useModules() return */
  const updateFlow = async (moduleId, flowId, data) => {
    const mod = modules.find((m) => m.id == moduleId);
    if (!mod) return;
    try {
      const updated = await api.updateFlow(flowId, data, mod.name);
      dispatch({ type: "UPDATE_FLOW", moduleId, id: flowId, patch: data });
      toast.success("Flow updated");
      return updated;
    } catch (error) {
      console.error("Failed to update flow:", error);
      toast.error(error.message || "Failed to update flow");
      throw error;
    }
  };

  const duplicateFlow = async (moduleId, flowId, name) => {
    try {
      const newFlow = await api.duplicateFlow(flowId, { name, targetModuleId: moduleId });
      dispatch({ type: "ADD_FLOW", moduleId, flow: newFlow });
      toast.success("Flow duplicated");
      return newFlow;
    } catch (error) {
      console.error("Failed to duplicate flow:", error);
      toast.error(error.message || "Failed to duplicate flow");
      throw error;
    }
  };

  const deleteFlow = async (moduleId, flowId) => {
    try {
      await api.deleteFlow(flowId);
      dispatch({ type: "DELETE_FLOW", moduleId, id: flowId });
      toast.success("Flow deleted");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to delete flow");
    }
  };

  /** Assign or clear env on a flow, then update local state */
  const setFlowEnvironment = async (flowId, envId) => {
    try {
      if (envId) {
        await api.updateFlowEnv(flowId, envId);
      } else {
        await api.clearFlowEnv(flowId);
      }
      dispatch({
        type: "UPDATE_FLOW",
        moduleId: state.selectedModuleId,
        id: flowId,
        patch: { defaultEnvironmentId: envId ? parseInt(envId) : null },
      });
      toast.success(envId ? "Flow environment assigned" : "Flow environment cleared");
    } catch (error) {
      console.error("Failed to set flow environment:", error);
      toast.error(error.message || "Failed to update flow environment");
      throw error;
    }
  };

  const fetchFlows = async (moduleId) => {
    if (!moduleId) return;
    const mod = modules.find((m) => m.id == moduleId);
    if (!mod) return;
    try {
      const flows = await api.getFlowsByModule(mod.name);
      dispatch({ type: "SET_FLOWS", moduleId, flows });
    } catch (e) {
      console.error(e);
    }
  };

  // ── Execution methods ─────────────────────────────────────────────────────

  const executeFlow = async (flowId, envId) => {
    dispatch({ type: "EXECUTION_START", id: flowId, execType: "flow" });
    try {
      const startRes = await api.executeFlow(flowId, envId);
      const executionId = startRes.flowExecutionId;
      
      let isRunning = true;
      let finalStatus = null;
      
      while (isRunning) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          const pollStatus = await api.getFlowExecutionStatus(executionId);
          dispatch({ type: "EXECUTION_POLLING", id: flowId, pollData: pollStatus });

          // Update step responses in real-time as each step completes
          const pollSteps = pollStatus?.steps || pollStatus?.stepResults || [];
          pollSteps.forEach(stepResult => {
            const stepId = stepResult.stepId;
            if (!stepId) return;
            // Only update steps that have a resolved status (not pending/queued)
            const stepStatus = (stepResult.status || "").toUpperCase();
            if (stepStatus === "PENDING" || stepStatus === "QUEUED" || !stepStatus) return;

            const responseBodyText = typeof stepResult.responseBody === 'object'
              ? JSON.stringify(stepResult.responseBody)
              : (stepResult.responseBody || "");

            const stepResponse = {
              status: stepResult.statusCode || (stepResult.status === "PASS" ? 200 : 500),
              statusText: stepResult.status || (stepResult.success ? "OK" : "Failed"),
              time: stepResult.durationMs || 0,
              size: responseBodyText ? new Blob([responseBodyText]).size : 0,
              body: responseBodyText,
              headers: [],
              resolvedUrl: stepResult.resolvedUrl || "",
              resolvedHeaders: stepResult.resolvedHeadersJson ? (() => {
                try {
                  return typeof stepResult.resolvedHeadersJson === "string" 
                    ? JSON.parse(stepResult.resolvedHeadersJson) 
                    : stepResult.resolvedHeadersJson;
                } catch {
                  return {};
                }
              })() : {},
              resolvedBody: stepResult.resolvedBodyJson ? (() => {
                try {
                  return typeof stepResult.resolvedBodyJson === "string" 
                    ? JSON.parse(stepResult.resolvedBodyJson) 
                    : stepResult.resolvedBodyJson;
                } catch {
                  return stepResult.resolvedBodyJson;
                }
              })() : null,
              isFromFlowRun: true
            };

            try {
              localStorage.setItem(`mr_auto_step_response_${stepId}`, JSON.stringify(stepResponse));
            } catch (e) {
              console.warn("Failed to save step response to localStorage:", e);
            }

            dispatch({
              type: "UPDATE_STEP",
              flowId: flowId,
              stepId: stepId,
              patch: { response: stepResponse }
            });
          });

          if (pollStatus.status === "PASS" || pollStatus.status === "FAIL" || pollStatus.status === "COMPLETED" || pollStatus.status === "ERROR") {
            isRunning = false;
            finalStatus = pollStatus;
          }
        } catch (pollError) {
          console.error("Failed to poll status:", pollError);
          isRunning = false;
          throw pollError;
        }
      }

      // Fetch full report data including response body once the run completes
      let reportData = null;
      try {
        reportData = await api.getFlowReportData(flowId);
      } catch (err) {
        console.error("Failed to fetch flow report data:", err);
      }

      // Persist step responses from this flow execution
      const steps = reportData?.steps || reportData?.stepResults || finalStatus?.steps || finalStatus?.stepResults || [];
      const mod = state.modules?.find(m => m.flows?.some(f => f.id == flowId));
      const flow = mod?.flows?.find(f => f.id == flowId);
      const flowStepIds = flow?.tests?.map(t => t.id) || steps.map(s => s.stepId);
      const executedStepMap = new Map(steps.map(s => [s.stepId, s]));

      flowStepIds.forEach(stepId => {
        const stepResult = executedStepMap.get(stepId);
        if (stepResult) {
          const responseBodyText = typeof stepResult.responseBody === 'object'
            ? JSON.stringify(stepResult.responseBody)
            : (stepResult.responseBody || "");

          const stepResponse = {
            status: stepResult.statusCode || (stepResult.status === "PASS" ? 200 : 500),
            statusText: stepResult.status || (stepResult.success ? "OK" : "Failed"),
            time: stepResult.durationMs || 0,
            size: responseBodyText ? new Blob([responseBodyText]).size : 0,
            body: responseBodyText,
            headers: [],
            resolvedUrl: stepResult.resolvedUrl || "",
            resolvedHeaders: stepResult.resolvedHeadersJson ? (() => {
              try {
                return typeof stepResult.resolvedHeadersJson === "string" 
                  ? JSON.parse(stepResult.resolvedHeadersJson) 
                  : stepResult.resolvedHeadersJson;
              } catch {
                return {};
              }
            })() : {},
            resolvedBody: stepResult.resolvedBodyJson ? (() => {
              try {
                return typeof stepResult.resolvedBodyJson === "string" 
                  ? JSON.parse(stepResult.resolvedBodyJson) 
                  : stepResult.resolvedBodyJson;
              } catch {
                return stepResult.resolvedBodyJson;
              }
            })() : null,
            isFromFlowRun: true
          };

          try {
            localStorage.setItem(`mr_auto_step_response_${stepId}`, JSON.stringify(stepResponse));
          } catch (e) {
            console.warn("Failed to save step response to localStorage:", e);
          }

          dispatch({
            type: "UPDATE_STEP",
            flowId: flowId,
            stepId: stepId,
            patch: { response: stepResponse }
          });
        } else {
          // Clear skipped step response
          try {
            localStorage.removeItem(`mr_auto_step_response_${stepId}`);
          } catch (e) {
            console.warn("Failed to remove step response from localStorage:", e);
          }

          dispatch({
            type: "UPDATE_STEP",
            flowId: flowId,
            stepId: stepId,
            patch: { response: null }
          });
        }
      });
      
      dispatch({ type: "EXECUTION_END", id: flowId, results: finalStatus, execType: "flow" });
      toast.success("Flow run completed");
      return finalStatus;
    } catch (error) {
      dispatch({
        type: "EXECUTION_END",
        id: flowId,
        results: { error: error.message },
        execType: "flow",
      });
      toast.error(error.message || "Flow run failed");
      throw error;
    }
  };

  const executeModule = async (moduleId, envId) => {
    dispatch({ type: "EXECUTION_START", id: moduleId, execType: "module" });
    try {
      const results = await api.executeModule(moduleId, envId);
      const executionId = results?.moduleExecutionId || results?.id;

      let reportData = null;
      if (executionId) {
        try {
          reportData = await api.getModuleReportData(executionId);
        } catch (err) {
          console.error("Failed to fetch module report data:", err);
        }
      }

      // Persist step responses from module execution results
      const flowResults = reportData?.flows || results?.flowResults || [];
      flowResults.forEach(flowRes => {
        const flowId = flowRes.flowId;
        const steps = flowRes.stepResults || flowRes.steps || [];
        const mod = state.modules?.find(m => m.id == moduleId);
        const flow = mod?.flows?.find(f => f.id == flowId);
        const flowStepIds = flow?.tests?.map(t => t.id) || steps.map(s => s.stepId);
        const executedStepMap = new Map(steps.map(s => [s.stepId, s]));

        flowStepIds.forEach(stepId => {
          const stepResult = executedStepMap.get(stepId);
          if (stepResult) {
            const responseBodyText = typeof stepResult.responseBody === 'object'
              ? JSON.stringify(stepResult.responseBody)
              : (stepResult.responseBody || "");

            const stepResponse = {
              status: stepResult.statusCode || (stepResult.status === "PASS" ? 200 : 500),
              statusText: stepResult.status || (stepResult.success ? "OK" : "Failed"),
              time: stepResult.durationMs || 0,
              size: responseBodyText ? new Blob([responseBodyText]).size : 0,
              body: responseBodyText,
              headers: [],
              resolvedUrl: stepResult.resolvedUrl || "",
              resolvedHeaders: stepResult.resolvedHeadersJson ? (() => {
                try {
                  return typeof stepResult.resolvedHeadersJson === "string" 
                    ? JSON.parse(stepResult.resolvedHeadersJson) 
                    : stepResult.resolvedHeadersJson;
                } catch {
                  return {};
                }
              })() : {},
              resolvedBody: stepResult.resolvedBodyJson ? (() => {
                try {
                  return typeof stepResult.resolvedBodyJson === "string" 
                    ? JSON.parse(stepResult.resolvedBodyJson) 
                    : stepResult.resolvedBodyJson;
                } catch {
                  return stepResult.resolvedBodyJson;
                }
              })() : null,
              isFromFlowRun: true
            };

            try {
              localStorage.setItem(`mr_auto_step_response_${stepId}`, JSON.stringify(stepResponse));
            } catch (e) {
              console.warn("Failed to save step response to localStorage:", e);
            }

            dispatch({
              type: "UPDATE_STEP",
              flowId: flowId,
              stepId: stepId,
              patch: { response: stepResponse }
            });
          } else {
            // Clear skipped step response
            try {
              localStorage.removeItem(`mr_auto_step_response_${stepId}`);
            } catch (e) {
              console.warn("Failed to remove step response from localStorage:", e);
            }

            dispatch({
              type: "UPDATE_STEP",
              flowId: flowId,
              stepId: stepId,
              patch: { response: null }
            });
          }
        });
      });

      dispatch({ type: "EXECUTION_END", id: moduleId, results, execType: "module" });
      toast.success("Module run completed");
      return results;
    } catch (error) {
      dispatch({
        type: "EXECUTION_END",
        id: moduleId,
        results: { error: error.message },
        execType: "module",
      });
      toast.error(error.message || "Module run failed");
      throw error;
    }
  };

  /**
   * FIX: executeBulk previously just fired and forgot.
   * Now it polls getBulkJobStatus until the job completes,
   * dispatching EXECUTION_POLLING updates along the way.
   */
  const executeBulkWithPolling = async (type, ids, envIds) => {
    dispatch({ type: "EXECUTION_START", id: "bulk", execType: "bulk", total: ids.length });
    try {
      const job = await api.executeBulk(type, ids, envIds);
      const jobId = job?.jobId || job?.id || job?.bulkJobId;

      if (!jobId) {
        // API returned synchronously — no polling needed
        dispatch({ type: "EXECUTION_END", id: "bulk", results: job, execType: "bulk" });
        toast.success("Bulk run completed");
        return job;
      }

      // Poll until terminal state
      return await new Promise((resolve, reject) => {
        let attempts = 0;
        const MAX_ATTEMPTS = 60; // 60 × 3s = 3 min max

        const poll = async () => {
          attempts++;
          try {
            const status = await api.getBulkJobStatus(jobId);
            dispatch({ type: "EXECUTION_POLLING", id: "bulk", pollData: status });

            const s = (status?.status || "").toUpperCase();
            const isTerminal = ["COMPLETED", "PASSED", "FAILED", "ERROR", "SUCCESS", "PARTIAL_FAIL"].includes(s);

            if (isTerminal) {
              dispatch({
                type: "EXECUTION_END",
                id: "bulk",
                results: { ...status, jobId },
                execType: "bulk",
              });
              toast.success("Bulk run completed");
              resolve(status);
              return;
            }

            if (attempts >= MAX_ATTEMPTS) {
              dispatch({
                type: "EXECUTION_END",
                id: "bulk",
                results: { error: "Timed out waiting for bulk job", jobId },
                execType: "bulk",
              });
              toast.error("Bulk run timed out");
              reject(new Error("Bulk job timed out"));
              return;
            }

            pollingTimers.current["bulk"] = setTimeout(poll, 3000);
          } catch (err) {
            dispatch({
              type: "EXECUTION_END",
              id: "bulk",
              results: { error: err.message, jobId },
              execType: "bulk",
            });
            toast.error(err.message || "Bulk run failed");
            reject(err);
          }
        };

        pollingTimers.current["bulk"] = setTimeout(poll, 2000);
      });
    } catch (error) {
      dispatch({
        type: "EXECUTION_END",
        id: "bulk",
        results: { error: error.message },
        execType: "bulk",
      });
      toast.error(error.message || "Bulk run failed");
      throw error;
    }
  };

  // ── Step methods ──────────────────────────────────────────────────────────

  const addStep = async (flowId, stepData) => {
    try {
      const newStep = await api.createStep(flowId, stepData);
      const step = mapStepToTest(newStep);
      dispatch({ type: "ADD_STEP", flowId, step });
      toast.success("Step created");
      return step;
    } catch (error) {
      console.error("Failed to create step:", error);
      toast.error(error.message || "Failed to create step");
      throw error;
    }
  };

  const updateStep = async (flowId, stepId, patch) => {
    const flow = selectedModule?.flows?.find((f) => f.id == flowId);
    const step = flow?.tests?.find((t) => t.id == stepId);
    if (!step) return;
    const updated = { ...step, ...patch };
    dispatch({ type: "UPDATE_STEP", flowId, stepId, patch });
    try {
      await api.updateStep(flowId, stepId, updated);
    } catch (error) {
      console.error("Failed to sync step update:", error);
      toast.error(error.message || "Failed to save step");
    }
  };

  const deleteStep = async (flowId, stepId) => {
    try {
      await api.deleteStep(flowId, stepId);
      dispatch({ type: "DELETE_STEP", flowId, stepId });
      toast.success("Step deleted");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to delete step");
    }
  };

  const duplicateStep = async (flowId, stepId, name) => {
    try {
      const newStep = await api.duplicateStep(flowId, stepId, name);
      const step = mapStepToTest(newStep);
      dispatch({ type: "ADD_STEP", flowId, step });
      toast.success("Step duplicated");
      return step;
    } catch (error) {
      console.error("Failed to duplicate step:", error);
      toast.error(error.message || "Failed to duplicate step");
      throw error;
    }
  };

  const reorderSteps = async (flowId, tests) => {
    const steps = (tests || []).map((step, index) => ({
      stepId: step.id,
      stepOrder: index + 1,
    }));
    await api.reorderSteps(flowId, steps);
    toast.success("Step order saved");
  };

  const fetchSteps = async (flowId) => {
    if (!flowId) return;
    try {
      const steps = await api.getSteps(flowId);
      dispatch({
        type: "SET_STEPS",
        flowId,
        steps: steps.map(mapStepToTest),
      });
    } catch (e) {
      console.error(e);
    }
  };

  return {
    // State
    modules,
    loading: state.loading,
    error: state.error,
    selectedModuleId: state.selectedModuleId,
    selectedFlowId: state.selectedFlowId,
    selectedStepId: state.selectedStepId,
    selectedEnvId: state.selectedEnvId,
    selectedModule,
    selectedFlow,
    selectedStep,
    selectedEnv,
    executions: state.executions,
    dispatch,

    // Module
    addModule,
    updateModule,       // FIX: was missing
    deleteModule,

    // Environment
    addEnvironment,
    updateEnvironment,
    deleteEnvironment,  // FIX: was missing

    // Schedule
    updateSchedule,
    deleteSchedule,

    // Flow
    addFlow,
    updateFlow,         // FIX: was missing
    duplicateFlow,
    deleteFlow,
    setFlowEnvironment, // NEW: PUT/DELETE /flows/:id/environment/:envId
    fetchFlows,

    // Execution
    executeFlow,
    executeModule,
    executeBulkWithPolling, // FIX: replaces fire-and-forget executeBulk

    // Steps
    addStep,
    updateStep,
    deleteStep,
    duplicateStep,
    fetchSteps,
    reorderSteps,
    importFlow,
  };
}
