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
    };

export type UIMessage =
  | {
      type: "finished frame";
    }
  | { type: "current save"; state: string };
