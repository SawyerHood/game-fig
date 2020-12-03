export type WorkerMessage =
  | {
      type: "render frame";
      svg: string;
    }
  | {
      type: "update scale";
      scale: number;
    }
  | {
      type: "save state";
      state: string;
    }
  | { type: "persist rom"; rom: string };

export type UIMessage =
  | {
      type: "finished frame";
    }
  | { type: "load persisted state"; state: string; rom: string };
