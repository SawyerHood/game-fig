import * as React from "react";
import * as ReactDOM from "react-dom";
import { WasmBoy } from "wasmboy";
import "./ui.css";
import type { WorkerMessage } from "./messages";
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
  Flex,
} from "@chakra-ui/react";

const manager: StorageManager = {
  get() {
    return "light";
  },
  set() {},
  type: "localStorage",
};

const { useState, useEffect, useRef } = React;

declare function require(path: string): any;

function sendMessage(msg: WorkerMessage) {
  parent.postMessage({ pluginMessage: msg }, "*");
}

let frame = 0;

const store = createStore({
  scale: GAMEBOY_SCALE,
});

store.subscribe(["scale"], () => {
  sendMessage({ type: "update scale", scale: store.getState().scale });
});

function App() {
  const [file, setFile] = useState<File | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scaledCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgContainer = useRef<HTMLDivElement | null>(null);
  const auger = useAuger(store);

  const [scale, setScale] = auger.scale.$();
  useEffect(() => {
    (async () => {
      WasmBoy._runNumberOfFrames;
      await WasmBoy.config(
        {
          updateGraphicsCallback(buffer) {
            frame++;
            if (frame % 5 !== 0) {
              return;
            }
            requestAnimationFrame(() => {
              const scale = store.getState().scale;
              const context = scaledCanvasRef.current.getContext("2d");
              context.drawImage(
                canvasRef.current,
                0,
                0,
                GAMEBOY_WIDTH * scale,
                GAMEBOY_HEIGHT * scale
              );
              const svg = ImageTracer.imagedataToSVG(
                context.getImageData(
                  0,
                  0,
                  GAMEBOY_WIDTH * scale,
                  GAMEBOY_HEIGHT * scale
                )
              );
              sendMessage({
                type: "render frame",
                svg,
              });
            });
          },
        },
        canvasRef.current
      );
      console.log("LOADED");
    })();
  }, []);

  return (
    <ChakraProvider colorModeManager={manager}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (file) {
            await WasmBoy.loadROM(file);
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
          <FormControl>
            <FormLabel>Scale:</FormLabel>
            <NumberInput
              type="number"
              value={scale}
              onChange={(scale) => setScale(() => +scale)}
            >
              <NumberInputField />
            </NumberInput>
          </FormControl>
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
