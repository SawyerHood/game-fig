export type WorkerMessage =
  | {
      type: "render frame";
      svg: string;
    }
  | {
      type: "save state";
      state: string;
      id: string;
    }
  | { type: "persist rom"; rom: string }
  | { type: "create gameboy"; name: string; rom: string };

export type UIMessage =
  | {
      type: "finished frame";
    }
  | { type: "load persisted state"; state: string; rom: string }
  | {
      type: "update current gameboy";
      id: string;
      name: string;
      rom: string;
      saveState: string | null;
    };
