export type WorkerMessage =
  | {
      type: "render frame";
      svg: string;
    }
  | {
      type: "update scale";
      scale: number;
    };

export type UIMessage = {
  type: "finished frame";
};
