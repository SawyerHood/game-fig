import * as React from "react";
import * as ReactDOM from "react-dom";
import { WasmBoy } from "wasmboy";
import "./ui.css";
import type { WorkerMessage, UIMessage } from "./messages";
import { GAMEBOY_HEIGHT, GAMEBOY_SCALE, GAMEBOY_WIDTH } from "./constants";
import { createStore, useAuger } from "auger-state";
import {
  ChakraProvider,
  Button,
  FormLabel,
  FormControl,
  StorageManager,
  Stack,
  Text,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from "@chakra-ui/react";

import potrace from "potrace";
import { promisify } from "es6-promisify";
import {
  encodeSaveState,
  decodeSaveState,
  decodeFigRom,
  FigRom,
  fileToFigRom,
  encodeFigRom,
} from "./encoding";

const posterize: (ArrayBuffer, any) => Promise<string> = promisify(
  potrace.posterize
);

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    });
  });
}

const manager: StorageManager = {
  get() {
    return "light";
  },
  set() {},
  type: "localStorage",
};

const { useState, useEffect, useRef } = React;

function sendMessage(msg: WorkerMessage) {
  parent.postMessage({ pluginMessage: msg }, "*");
}

const store = createStore({
  readyForFrame: false,
});

let currentSave = null;
let rom: FigRom | null = null;

window.onmessage = async ({
  data: { pluginMessage: msg },
}: {
  data: { pluginMessage: UIMessage };
}) => {
  switch (msg.type) {
    case "finished frame": {
      store.update((draft) => {
        draft.readyForFrame = true;
      });
      return;
    }
    case "load persisted state": {
      currentSave = decodeSaveState(msg.state);
      rom = decodeFigRom(msg.rom);
      await WasmBoy.loadROM(rom.rom);
      if (currentSave) {
        await WasmBoy.loadState(currentSave);
      }
      await WasmBoy.play();
      return;
    }
  }
};

function App() {
  const [file, setFile] = useState<File | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scaledCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgContainer = useRef<HTMLDivElement | null>(null);
  const auger = useAuger(store);

  useEffect(() => {
    (async () => {
      await WasmBoy.config(
        {
          useGbcWhenOptional: false,
          updateGraphicsCallback() {
            requestAnimationFrame(async () => {
              const { readyForFrame } = store.getState();

              if (!readyForFrame) {
                return;
              }

              const context = scaledCanvasRef.current.getContext("2d");
              context.drawImage(
                canvasRef.current,
                0,
                0,
                GAMEBOY_WIDTH * GAMEBOY_SCALE,
                GAMEBOY_HEIGHT * GAMEBOY_SCALE
              );
              store.update((draft) => {
                draft.readyForFrame = false;
              });
              const blob = await toBlob(scaledCanvasRef.current);
              const buffer = await blob.arrayBuffer();
              const svg = await posterize(buffer, { threshold: 180, steps: 4 });
              sendMessage({
                type: "render frame",
                svg,
              });
            });
          },
        },
        canvasRef.current
      );
    })();
  }, []);

  const saveGame = async () => {
    const save = await WasmBoy.saveState();
    sendMessage({ type: "save state", state: encodeSaveState(save) });
    WasmBoy.play();
  };

  const loadRom = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (file) {
      await WasmBoy.loadROM(file);
      const figRom = await fileToFigRom(file);
      sendMessage({
        type: "persist rom",
        rom: encodeFigRom(figRom),
      });
      if (currentSave) {
        await WasmBoy.loadState(currentSave);
      }
      await WasmBoy.play();
    }
  };

  const pickRom = () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.onchange = (e: any) => {
      setFile(e.target.files[0]);
    };
    fileInput.click();
  };

  return (
    <ChakraProvider colorModeManager={manager}>
      <form onSubmit={loadRom}>
        <Stack padding={4} spacing={4}>
          <FormControl>
            <FormLabel>Game Boy ROM</FormLabel>
            <Stack spacing={4} direction="row" align="center">
              <Text fontSize="l" color="gray.700">
                {file?.name ?? "No ROM Selected"}
              </Text>
              <Button onClick={pickRom}>Select ROM</Button>
            </Stack>
          </FormControl>
          <Button onClick={saveGame}>Save Game</Button>
          <Button type="submit" colorScheme="teal">
            Load ROM
          </Button>
        </Stack>
      </form>
      <canvas
        ref={canvasRef}
        width={GAMEBOY_WIDTH}
        height={GAMEBOY_HEIGHT}
        className="hiddenCanvas"
      />
      <canvas
        ref={scaledCanvasRef}
        width={GAMEBOY_WIDTH * GAMEBOY_SCALE}
        height={GAMEBOY_HEIGHT * GAMEBOY_SCALE}
        className="hiddenCanvas"
      />
      <div
        ref={svgContainer}
        style={{ width: GAMEBOY_WIDTH, height: GAMEBOY_HEIGHT }}
      />
    </ChakraProvider>
  );
}

ReactDOM.render(<App />, document.getElementById("react-page"));
