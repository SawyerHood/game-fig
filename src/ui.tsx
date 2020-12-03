import * as React from "react";
import * as ReactDOM from "react-dom";
import { WasmBoy } from "wasmboy";
import "./ui.css";
import type { WorkerMessage, UIMessage } from "./messages";
import ImageTracer from "imagetracerjs";
import { GAMEBOY_HEIGHT, GAMEBOY_SCALE, GAMEBOY_WIDTH } from "./constants";
import { createStore, useAuger } from "auger-state";
import {
  ChakraProvider,
  Button,
  FormLabel,
  FormControl,
  StorageManager,
  NumberInput,
  NumberInputField,
  Stack,
  Text,
} from "@chakra-ui/react";
import potrace from "potrace";
import { promisify } from "es6-promisify";
import { encodeSaveState, decodeSaveState } from "./encoding";

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

let frame = 0;

const store = createStore({
  scale: GAMEBOY_SCALE,
  readyForFrame: false,
});

let currentSave = null;

store.subscribe(["scale"], () => {
  sendMessage({ type: "update scale", scale: store.getState().scale || 1 });
});

window.onmessage = ({
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
    case "current save": {
      currentSave = decodeSaveState(msg.state);
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

  const [scale, setScale] = auger.scale.$();
  useEffect(() => {
    (async () => {
      await WasmBoy.config(
        {
          useGbcWhenOptional: false,
          updateGraphicsCallback() {
            frame++;
            if (frame % 5 !== 0) {
              return;
            }
            requestAnimationFrame(async () => {
              const { scale, readyForFrame } = store.getState();

              if (!readyForFrame) {
                return;
              }

              const context = scaledCanvasRef.current.getContext("2d");
              context.drawImage(
                canvasRef.current,
                0,
                0,
                GAMEBOY_WIDTH * scale,
                GAMEBOY_HEIGHT * scale
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

  return (
    <ChakraProvider colorModeManager={manager}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (file) {
            await WasmBoy.loadROM(file);
            if (currentSave) {
              console.log(currentSave);
              await WasmBoy.loadState(currentSave);
            }
            await WasmBoy.play();
          }
        }}
      >
        <Stack padding={4} spacing={4}>
          <FormControl>
            <FormLabel>Game Boy ROM</FormLabel>
            <Stack spacing={4} direction="row" align="center">
              <Text fontSize="l" color="gray.700">
                {file?.name ?? "No ROM Selected"}
              </Text>
              <Button
                onClick={() => {
                  const fileInput = document.createElement("input");
                  fileInput.type = "file";
                  fileInput.onchange = (e: any) => {
                    setFile(e.target.files[0]);
                  };
                  fileInput.click();
                }}
              >
                Select ROM
              </Button>
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
        width={GAMEBOY_WIDTH * scale}
        height={GAMEBOY_HEIGHT * scale}
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
