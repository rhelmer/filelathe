declare module "chiptune3" {
  export type ChiptuneConfig = {
    repeatCount?: number;
    stereoSeparation?: number;
    interpolationFilter?: number;
    context?: AudioContext | false;
  };

  export class ChiptuneJsPlayer {
    context: AudioContext;
    duration?: number;
    currentTime?: number;
    constructor(cfg?: ChiptuneConfig);
    onInitialized(handler: () => void): void;
    onEnded(handler: () => void): void;
    onError(handler: (err: { type?: string }) => void): void;
    onMetadata(handler: (meta: Record<string, unknown>) => void): void;
    onProgress(handler: (info: { pos?: number }) => void): void;
    play(buffer: ArrayBuffer): void;
    stop(): void;
    pause(): void;
    unpause(): void;
    togglePause(): void;
    setRepeatCount(val: number): void;
    setPos(val: number): void;
    setVol(val: number): void;
  }
}
