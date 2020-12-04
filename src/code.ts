/// <reference path="../node_modules/@figma/plugin-typings/index.d.ts" />

import type { WorkerMessage, UIMessage } from "./messages";
import {
  GAMEBOY_HEIGHT,
  GAMEBOY_SCALE,
  GAMEBOY_WIDTH,
  GAMEBOY_SVG,
} from "./constants";

let gbRoot: FrameNode | null;
let gbScreen: FrameNode | null;

figma.on("selectionchange", () => {
  const root = figma.currentPage.selection.find((node) =>
    Boolean(node.getPluginData("root"))
  ) as FrameNode;

  if (!root) {
    return;
  }

  const screen = root.children.find((node) =>
    Boolean(node.getPluginData("screen"))
  ) as FrameNode;

  if (!screen) {
    return;
  }

  gbRoot = root;
  gbScreen = screen;

  sendUIMessage({
    type: "update current gameboy",
    id: gbRoot.id,
    name: gbRoot.name,
    rom: gbRoot.getPluginData("rom"),
    saveState: gbRoot.getPluginData("save"),
  });
});

function sendUIMessage(msg: UIMessage) {
  figma.ui.postMessage(msg);
}

function createGameBoy() {
  const root = figma.createFrame();
  root.fills = [];
  root.resize(560, 951);
  root.name = "GameBoy";
  root.setPluginData("root", "true");
  const gameboyNode = figma.createNodeFromSvg(GAMEBOY_SVG);
  root.appendChild(gameboyNode);
  const screen = figma.createFrame();
  screen.fills = [];
  screen.resize(GAMEBOY_WIDTH * GAMEBOY_SCALE, GAMEBOY_HEIGHT * GAMEBOY_SCALE);
  root.appendChild(screen);
  screen.x = 119;
  screen.y = 85;
  screen.setPluginData("screen", "true");
  figma.viewport.scrollAndZoomIntoView([root]);
  return root;
}

figma.showUI(__html__, { width: 500, height: 500 });

sendUIMessage({ type: "finished frame" });

figma.ui.onmessage = (msg: WorkerMessage) => {
  switch (msg.type) {
    case "render frame": {
      const frame = figma.createNodeFromSvg(msg.svg);
      gbScreen?.children.forEach((node) => node.remove());
      gbScreen?.appendChild(frame);
      sendUIMessage({ type: "finished frame" });
      return;
    }
    case "save state": {
      const node = figma.getNodeById(msg.id);
      node?.setPluginData("save", msg.state);
      return;
    }
    case "create gameboy": {
      const frame = createGameBoy();
      frame.name = msg.name;
      frame.setPluginData("rom", msg.rom);
      figma.currentPage.selection = [frame];
      return;
    }
  }
};
