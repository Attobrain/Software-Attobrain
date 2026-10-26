/** Documentation contracts; runtime remains plain JavaScript. */
export type Eligibility = "eligible" | "limited" | "insufficient" | "unavailable";
export interface Metric {
  id: string;
  name: string;
  value: number | null;
  unit: string;
  definition: string;
  definitionVersion: string;
  source: string;
  supportCount: number | null;
  eligibility: Eligibility;
  reason: string | null;
  limitations: string[];
}
export interface CollisionEpisode {
  id: string;
  start: number;
  end: number;
  sessionTime: number;
  sessionEnd: number;
  position: { x: number; y: number };
  endPosition: { x: number; y: number };
  cell: number;
  walls: number[];
  eventSeqs: number[];
  censored: boolean;
  duration: number | null;
  reason: "recovered" | "interruption" | "input-gap" | "end" | "pending";
}
export interface Evidence extends Metric {
  runId: string;
  label: string;
  metric: string;
  eventSeqs: number[];
  episodeIds: string[];
  sessionTime: number;
  interval: [number, number | null];
}
export interface Observation {
  id: string;
  ruleId: string;
  ruleVersion: string;
  title: string;
  dimension: string;
  statement: string;
  priority: number;
  support: "sufficient_for_description";
  criteria: string;
  evidence: Evidence[];
  limitations: string[];
  reviewPoint?: string;
}
