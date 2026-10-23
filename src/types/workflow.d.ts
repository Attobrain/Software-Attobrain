export type GuidedStep = "participant" | "configuration" | "review" | "training" | "activity" | "A" | "B" | "C" | "results";
export type RunState = "READY" | "RUNNING" | "PAUSED" | "COMPLETED" | "TIMED_OUT" | "ABORTED";
export interface DemonstrationParticipant { id: string; name: string; demonstration: true }
export interface Presence { visible: boolean; recent: boolean }
export interface WorkflowActions { select: boolean; configure: boolean; begin: boolean; start: boolean; resume: boolean; pause: boolean; abort: boolean; next: boolean; repeat: boolean; end: boolean }
export interface WorkflowView { step: GuidedStep; controlRevision: number; participant: DemonstrationParticipant | null; studentReady: boolean; actions: WorkflowActions }
export interface SessionConfiguration { mode: "protocol" | "single"; level: 7 | 10; seed: number; trainingSeconds: number; activitySeconds: number; intervalSeconds: number; speed: number; radius: number; wallWidth: number; lowSpeed: number; lowSeconds: number; eegMode: "independent" | "interactive"; channels: 1 | 4 | 8; sampleRate: 250 | 500; eegSeed: number; artifacts: boolean }
export interface CommandEnvelope { id: string; commandId: string; expectedRevision: number }
export type GuidedCommand = CommandEnvelope & (
  | { type: "select-participant"; participant: Pick<DemonstrationParticipant, "id" | "name"> }
  | { type: "configure"; config: SessionConfiguration }
  | { type: "back"; step: "participant" | "configuration" }
  | { type: "abort" | "end-session"; reason: "voluntary" | "technical" }
  | { type: "notes"; value: string }
  | { type: "begin" | "start" | "pause" | "resume" | "next" | "repeat-training" | "reanalyze" }
);
export type Eligibility = "eligible" | "limited";
export interface AnalysisFeature { value: number | null; unit: string; eligibility: Eligibility; reason: string | null; supportCount: number | null; definitionVersion: string }
export interface Evidence extends AnalysisFeature { runId: string; label: string; metric: string; eventSeqs: number[]; sessionTime: number; interval: [number | null, number | null] }
export interface Observation { id: string; ruleId: string; ruleVersion: string; title: string; statement: string; support: "sufficient"; criteria: string; evidence: Evidence[]; limitations: string[] }
export interface Interpretation { schemaVersion: "attobrain-interpretation-1.0"; quality: { status: "sufficient" | "limited" | "insufficient"; performed: number; completed: number; expected: number; comparable: boolean; coverageKnown: boolean; clinicalInference: "not_available" }; observations: Observation[]; summary: string[]; limitations: string[] }
