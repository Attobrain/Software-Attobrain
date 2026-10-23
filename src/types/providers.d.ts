export interface Position {
  x: number;
  y: number;
}
export interface InputSample extends Position {
  runId: string;
  seq: number;
  clientTime: number;
  inside: boolean;
  hidden: boolean;
}
export interface InputProvider {
  readonly source: "mouse" | "gaze";
  read(): InputSample | null;
}
export interface EEGBlock {
  startIndex: number;
  sampleRate: 250 | 500;
  channels: Float32Array[];
  unit: "synthetic-uV";
}
export interface EEGProvider {
  generate(startIndex: number, count: number): EEGBlock;
}
// Reserved contracts only. No device, calibration or physiological inference.
export interface GazeInputProvider extends InputProvider {
  readonly source: "gaze";
}
export interface RealEEGProvider {
  readonly connected: false;
}
