/**
 * Agency state schema for the LangGraph orchestrator.
 * Each node receives this state and returns a partial update.
 */
import { Annotation } from "@langchain/langgraph";

export const AgencyStateAnnotation = Annotation.Root({
  taskId: Annotation(),
  taskDescription: Annotation(),
  taskType: Annotation(),
  snapshot: Annotation(),
  currentPhase: Annotation(),
  phases: Annotation({
    reducer: (left, right) => ({ ...left, ...right }),
    default: () => ({}),
  }),
  kpiPassed: Annotation(),
  attemptCount: Annotation({
    reducer: (_, right) => right,
    default: () => ({}),
  }),
  error: Annotation(),
});
