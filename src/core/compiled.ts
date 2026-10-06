import type { PhaseConfig } from "../types/config.js";

export interface CompiledPhase<Name extends string = string> {
  name: Name;
  config: PhaseConfig;
  from?: Date;
  until?: Date;
}

export interface CompiledLaunch<Name extends string = string> {
  id: string;
  phases: readonly CompiledPhase<Name>[];
}
