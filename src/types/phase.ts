export type PhaseStatus = "completed" | "active" | "upcoming";

export interface TimelineEntry<PhaseName extends string = string> {
  name: PhaseName;
  status: PhaseStatus;
  from?: string;
  until?: string;
  rollout?: number;
}
