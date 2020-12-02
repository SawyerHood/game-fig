/// <reference path="../node_modules/@figma/plugin-typings/index.d.ts" />

import type { WorkerMessage, UIMessage } from "./messages";
import { GAMEBOY_HEIGHT, GAMEBOY_SCALE, GAMEBOY_WIDTH } from "./constants";

let scale = GAMEBOY_SCALE;

function sendUIMessage(msg: UIMessage) {
  figma.ui.postMessage(msg);
}

figma.showUI(__html__, { width: 500, height: 500 });
let gbRoot = figma.currentPage.findOne((node) => {
  return Boolean(node.getPluginData("game-fig-root"));
}) as FrameNode;

if (!gbRoot) {
  gbRoot = figma.createFrame();
  gbRoot.resize(GAMEBOY_WIDTH * scale, GAMEBOY_HEIGHT * scale);
  gbRoot.setPluginData("game-fig-root", "true");
  gbRoot.name = "GameBoy";
  figma.viewport.scrollAndZoomIntoView([gbRoot]);
}

sendUIMessage({ type: "finished frame" });

figma.ui.onmessage = (msg: WorkerMessage) => {
  switch (msg.type) {
    case "render frame": {
      const screen = figma.createNodeFromSvg(msg.svg);
      gbRoot.children.forEach((node) => node.remove());
      gbRoot.appendChild(screen);
      sendUIMessage({ type: "finished frame" });
      return;
    }
    case "update scale": {
      scale = msg.scale;
      gbRoot.resize(GAMEBOY_WIDTH * scale, GAMEBOY_HEIGHT * scale);
      return;
    }
  }
};
