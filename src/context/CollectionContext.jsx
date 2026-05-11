import { createContext, useContext, useReducer, useEffect, useState } from "react";
import { api, mapStepToTest } from "../utils/api";

const ModuleContext = createContext(null);

const initialState = {
  modules: [],
  selectedModuleId: null,
  selectedFlowId: null,
  selectedStepId: null,
  loading: false,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.error };
    case "SET_STATE":
      return { ...state, ...action.payload, loading: false };

    case "ADD_MODULE": {
      return { ...state, modules: [...state.modules, action.module], loading: false };
    }

    case "DELETE_MODULE": {
      const next = state.modules.filter((m) => m.id != action.id);
      return {
        ...state,
        modules: next,
        selectedModuleId: state.selectedModuleId == action.id ? null : state.selectedModuleId,
      };
    }
    case "UPDATE_MODULE": {
      return {
        ...state,
        modules: state.modules.map((m) => m.id == action.id ? { ...m, ...action.patch } : m),
      };
    }

    case "SELECT_MODULE": {
      return {
        ...state,
        selectedModuleId: action.id,
        selectedFlowId: null,
        selectedStepId: null,
      };
    }

    case "SET_FLOWS": {
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id == action.moduleId ? { 
            ...m, 
            flows: (action.flows || []).map(f => ({ ...f, tests: null, stepsLoaded: false })), 
            flowsLoaded: true 
          } : m
        ),
      };
    }

    case "ADD_FLOW": {
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id == action.moduleId ? { ...m, flows: [...(m.flows || []), { ...action.flow, tests: [] }] } : m
        ),
        selectedFlowId: action.flow.id,
        selectedStepId: null,
        loading: false,
      };
    }

    case "DELETE_FLOW": {
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id == action.moduleId
            ? { ...m, flows: (m.flows || []).filter((f) => f.id != action.id) }
            : m
        ),
        selectedFlowId: state.selectedFlowId == action.id ? null : state.selectedFlowId,
      };
    }
    case "UPDATE_FLOW": {
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id == action.moduleId
            ? {
              ...m,
              flows: (m.flows || []).map((f) => f.id == action.id ? { ...f, ...action.patch } : f),
            }
            : m
        ),
      };
    }

    case "SELECT_FLOW": {
      return {
        ...state,
        selectedFlowId: action.id,
        selectedStepId: null,
      };
    }

    case "SET_STEPS": {
      return {
        ...state,
        modules: state.modules.map((m) => ({
          ...m,
          flows: (m.flows || []).map((f) =>
            f.id == action.flowId ? { ...f, tests: action.steps, stepsLoaded: true } : f
          ),
        })),
        selectedStepId: action.steps?.[0]?.id || null,
      };
    }

    case "ADD_STEP": {
      return {
        ...state,
        modules: state.modules.map((m) => ({
          ...m,
          flows: (m.flows || []).map((f) =>
            f.id == action.flowId ? { ...f, tests: [...(f.tests || []), action.step], stepsLoaded: true } : f
          ),
        })),
        selectedStepId: action.step.id,
        loading: false,
      };
    }

    case "UPDATE_STEP": {
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
    }

    case "DELETE_STEP": {
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
        selectedStepId: state.selectedStepId == action.stepId ? null : state.selectedStepId,
      };
    }

    case "SELECT_STEP":
      return { ...state, selectedStepId: action.id };

    case "UPDATE_FLOW_VARIABLES": {
      return {
        ...state,
        modules: state.modules.map((m) => ({
          ...m,
          flows: (m.flows || []).map((f) =>
            f.id == action.flowId ? { ...f, variables: { ...f.variables, ...action.variables } } : f
          ),
        })),
      };
    }

    default:
      return state;
  }
}

export function ModuleProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Initial load: Fetch Modules
  useEffect(() => {
    async function load() {
      console.log("Fetching initial modules...");
      dispatch({ type: "FETCH_START" });
      try {
        const modules = await api.getModules();
        console.log("Modules loaded:", modules);
        dispatch({
          type: "SET_STATE",
          payload: { modules: modules.map(m => ({ ...m, flows: null, flowsLoaded: false })) }
        });
      } catch (error) {
        console.error("Initial load failed:", error);
        dispatch({ type: "FETCH_ERROR", error: error.message });
      }
    }
    load();
  }, []);

  // Fetch flows when a module is selected
  useEffect(() => {
    if (!state.selectedModuleId) return;

    const mod = state.modules.find(m => m.id == state.selectedModuleId);
    if (mod && !mod.flowsLoaded) {
      async function loadFlows() {
        console.log(`Fetching flows for module name "${mod.name}"...`);
        try {
          const flows = await api.getFlowsByModule(mod.name);
          console.log(`Flows for module "${mod.name}":`, flows);
          dispatch({ type: "SET_FLOWS", moduleId: mod.id, flows });
        } catch (error) {
          console.error("Failed to load flows:", error);
          try {
            const allFlows = await api.getFlows();
            const filtered = allFlows.filter(f => f.module === mod.name || String(f.moduleId) === String(mod.id));
            dispatch({ type: "SET_FLOWS", moduleId: state.selectedModuleId, flows: filtered });
          } catch (e) {
            console.error("Global flow fallback failed:", e);
            dispatch({ type: "SET_FLOWS", moduleId: state.selectedModuleId, flows: [] });
          }
        }
      }
      loadFlows();
    }
  }, [state.selectedModuleId, state.modules]);

  // Fetch steps when a flow is selected
  useEffect(() => {
    if (!state.selectedFlowId) return;

    const mod = state.modules.find(m => m.id == state.selectedModuleId);
    const flow = mod?.flows?.find(f => f.id == state.selectedFlowId);

    if (flow && !flow.stepsLoaded) {
      async function loadSteps() {
        console.log(`Fetching steps for flow ${state.selectedFlowId}...`);
        try {
          const steps = await api.getSteps(state.selectedFlowId);
          const tests = steps.map(mapStepToTest);
          dispatch({ type: "SET_STEPS", flowId: state.selectedFlowId, steps: tests });
        } catch (error) {
          console.error("Failed to load steps:", error);
          dispatch({ type: "SET_STEPS", flowId: state.selectedFlowId, steps: flow.tests || [] });
        }
      }
      loadSteps();
    }
  }, [state.selectedFlowId, state.selectedModuleId, state.modules]);

  return (
    <ModuleContext.Provider value={{ state, dispatch }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useModules() {
  const ctx = useContext(ModuleContext);
  if (!ctx) throw new Error("useModules must be used within ModuleProvider");

  const { state, dispatch } = ctx;
  const modules = state?.modules || [];

  const selectedModule = modules.find((m) => m.id == state.selectedModuleId);
  const selectedFlow = selectedModule?.flows?.find((f) => f.id == state.selectedFlowId);
  const selectedStep = selectedFlow?.tests?.find((t) => t.id == state.selectedStepId);

  const addModule = async (name, description) => {
    dispatch({ type: "FETCH_START" });
    try {
      const newMod = await api.createModule({ name, description });
      dispatch({ type: "ADD_MODULE", module: { ...newMod, flows: [] } });
      return newMod;
    } catch (error) {
      dispatch({ type: "FETCH_ERROR", error: error.message });
      throw error;
    }
  };

  const deleteModule = async (id) => {
    try {
      await api.deleteModule(id);
      dispatch({ type: "DELETE_MODULE", id });
    } catch (error) {
      console.error(error);
    }
  };

  const updateModule = async (id, data) => {
    try {
      await api.updateModule(id, data);
      dispatch({ type: "UPDATE_MODULE", id, patch: data });
    } catch (error) {
      console.error(error);
    }
  };

  const addFlow = async (moduleId, name, description) => {
    let mod = modules.find(m => m.id == moduleId);
    if (!mod && modules.length > 0) mod = modules[0];
    if (!mod) return;
    try {
      const newFlow = await api.createFlow({ name, description }, mod.name);
      dispatch({ type: "ADD_FLOW", moduleId: mod.id, flow: newFlow });
      return newFlow;
    } catch (error) {
      console.error("Failed to create flow:", error);
      throw error;
    }
  };

  const deleteFlow = async (moduleId, flowId) => {
    try {
      await api.deleteFlow(flowId);
      dispatch({ type: "DELETE_FLOW", moduleId, id: flowId });
    } catch (error) {
      console.error(error);
    }
  };

  const updateFlow = async (moduleId, flowId, data) => {
    const mod = modules.find(m => m.id == moduleId);
    if (!mod) return;
    try {
      await api.updateFlow(flowId, data, mod.name);
      dispatch({ type: "UPDATE_FLOW", moduleId, id: flowId, patch: data });
    } catch (error) {
      console.error(error);
    }
  };

  const addStep = async (flowId, stepData) => {
    let flow;
    if (state.selectedModuleId) {
      const mod = modules.find(m => m.id == state.selectedModuleId);
      flow = mod?.flows?.find(f => f.id == flowId);
    } else {
      for (const m of modules) {
        flow = m.flows?.find(f => f.id == flowId);
        if (flow) break;
      }
    }
    const index = flow?.tests?.length || 0;
    try {
      const newStep = await api.createStep(flowId, stepData, index);
      const step = mapStepToTest(newStep);
      dispatch({ type: "ADD_STEP", flowId, step });
      return step;
    } catch (error) {
      console.error("Failed to create step:", error);
      throw error;
    }
  };

  const updateStep = async (flowId, stepId, patch) => {
    let flow;
    if (state.selectedModuleId) {
      const mod = modules.find(m => m.id == state.selectedModuleId);
      flow = mod?.flows?.find(f => f.id == flowId);
    } else {
      for (const m of modules) {
        flow = m.flows?.find(f => f.id == flowId);
        if (flow) break;
      }
    }
    const step = flow?.tests?.find(t => t.id == stepId);
    if (!step) return;
    const updated = { ...step, ...patch };
    const index = (step.stepOrder || 1) - 1;
    dispatch({ type: "UPDATE_STEP", flowId, stepId, patch });
    try {
      await api.updateStep(flowId, stepId, updated, index);
    } catch (error) {
      console.error("Failed to sync step update:", error);
    }
  };

  const deleteStep = async (flowId, stepId) => {
    try {
      await api.deleteStep(flowId, stepId);
      dispatch({ type: "DELETE_STEP", flowId, stepId });
    } catch (error) {
      console.error(error);
    }
  };

  const fetchFlows = async (moduleId) => {
    if (!moduleId) return;
    const mod = modules.find(m => m.id == moduleId);
    if (!mod) return;
    try {
      console.log(`Manually fetching flows for module name "${mod.name}"...`);
      const flows = await api.getFlowsByModule(mod.name);
      dispatch({ type: "SET_FLOWS", moduleId, flows });
    } catch (error) {
      console.error("Manual flow fetch failed:", error);
    }
  };

  const fetchSteps = async (flowId) => {
    if (!flowId) return;
    try {
      console.log(`Manually fetching steps for flow ${flowId}...`);
      const steps = await api.getSteps(flowId);
      const tests = steps.map(mapStepToTest);
      dispatch({ type: "SET_STEPS", flowId, steps: tests });
    } catch (error) {
      console.error("Manual step fetch failed:", error);
    }
  };

  return {
    modules,
    loading: state.loading,
    error: state.error,
    selectedModuleId: state.selectedModuleId,
    selectedFlowId: state.selectedFlowId,
    selectedStepId: state.selectedStepId,
    selectedModule,
    selectedFlow,
    selectedStep,
    dispatch,
    addModule,
    updateModule,
    deleteModule,
    addFlow,
    updateFlow,
    deleteFlow,
    addStep,
    updateStep,
    deleteStep,
    fetchFlows,
    fetchSteps,
  };
}
