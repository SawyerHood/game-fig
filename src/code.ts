/// <reference path="../node_modules/@figma/plugin-typings/index.d.ts" />

import type { WorkerMessage, UIMessage } from "./messages";
import {
  GAMEBOY_HEIGHT,
  GAMEBOY_SCALE,
  GAMEBOY_WIDTH,
  GAMEBOY_SVG,
} from "./constants";

let scale = GAMEBOY_SCALE;
let gbRoot: FrameNode;

function sendUIMessage(msg: UIMessage) {
  figma.ui.postMessage(msg);
}

function createGameBoy() {
  const root = figma.createFrame();
  root.fills = [];
  root.resize(560, 951);
  root.name = "GameBoy";
  const gameboyNode = figma.createNodeFromSvg(GAMEBOY_SVG);
  root.appendChild(gameboyNode);
  const screen = figma.createFrame();
  screen.fills = [];
  screen.resize(GAMEBOY_WIDTH * scale, GAMEBOY_HEIGHT * scale);
  root.appendChild(screen);
  screen.x = 119;
  screen.y = 85;
  screen.setPluginData("game-fig-root", "true");
  figma.viewport.scrollAndZoomIntoView([root]);

  gbRoot = screen;
}

figma.showUI(__html__, { width: 500, height: 500 });

gbRoot = figma.currentPage.findOne((node) => {
  return Boolean(node.getPluginData("game-fig-root"));
}) as FrameNode;

if (gbRoot) {
  const state = gbRoot.getPluginData("save");
  const rom = gbRoot.getPluginData("rom");
  sendUIMessage({
    type: "load persisted state",
    state,
    rom,
  });
} else {
  createGameBoy();
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
    case "save state": {
      gbRoot.setPluginData("save", msg.state);
      return;
    }
    case "persist rom": {
      gbRoot.setPluginData("rom", msg.rom);
      return;
    }
  }
};
