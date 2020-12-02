export type WorkerMessage =
  | {
      type: "render frame";
      svg: string;
    }
  | {
      type: "update scale";
      scale: number;
    };
