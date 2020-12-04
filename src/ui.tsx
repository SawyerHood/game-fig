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
  Box,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  SimpleGrid,
  Heading,
  GridItem,
  Badge,
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
  SaveState,
} from "./encoding";

const TABS = ["create", "play"] as const;

type Tab = typeof TABS[number];

type CurrentGameBoy = {
  id: string;
  name: string;
  rom: FigRom | null;
  saveState: SaveState;
};

type AppState = {
  isFigmaReadyForFrame: boolean;
  isEmulatorPlaying: boolean;
  tab: Tab;
  selectedGameboyID: string | null;
  currentGameBoy: CurrentGameBoy | null;
  gamesBoysByID: { [id: string]: { name: string } };
};

/**
 * createGameboy
 * play
 * pause
 * selectGame
 */

const posterize: (
  buffer: ArrayBuffer,
  params: any
) => Promise<string> = promisify(potrace.posterize);

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
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

const store = createStore<AppState>({
  isFigmaReadyForFrame: false,
  isEmulatorPlaying: false,
  tab: "create",
  selectedGameboyID: null,
  currentGameBoy: null,
  gamesBoysByID: {},
});

let currentSave: any = null;
let rom: FigRom | null = null;

window.onmessage = async ({
  data: { pluginMessage: msg },
}: {
  data: { pluginMessage: UIMessage };
}) => {
  switch (msg.type) {
    case "finished frame": {
      store.update((draft) => {
        draft.isFigmaReadyForFrame = true;
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
    case "update current gameboy": {
      const oldState = store.getState();
      if (oldState.currentGameBoy) {
        const { id } = oldState.currentGameBoy;
        store.update((draft) => {
          draft.isEmulatorPlaying = false;
        });
        const saveState = await WasmBoy.saveState();
        sendMessage({
          type: "save state",
          state: encodeSaveState(saveState),
          id,
        });
      }
      const figRom = decodeFigRom(msg.rom);
      const saveState = msg.saveState ? decodeSaveState(msg.saveState) : null;
      store.update((draft) => {
        draft.currentGameBoy = {
          id: msg.id,
          name: msg.name,
          rom,
          saveState,
        };
        draft.tab = "play";
      });
      await WasmBoy.loadROM(figRom.rom);
      if (saveState) {
        await WasmBoy.loadState(saveState);
      }
    }
  }
};
function useWasmBoy(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  scaledCanvasRef: React.RefObject<HTMLCanvasElement>
) {
  useEffect(() => {
    (async () => {
      await WasmBoy.config(
        {
          useGbcWhenOptional: false,
          updateGraphicsCallback() {
            requestAnimationFrame(async () => {
              const { isFigmaReadyForFrame } = store.getState();

              if (!isFigmaReadyForFrame) {
                return;
              }

              const context = scaledCanvasRef.current?.getContext("2d");
              const canvas = canvasRef.current;

              if (!context || !canvas) {
                return;
              }

              context.drawImage(
                canvas,
                0,
                0,
                GAMEBOY_WIDTH * GAMEBOY_SCALE,
                GAMEBOY_HEIGHT * GAMEBOY_SCALE
              );
              store.update((draft) => {
                draft.isFigmaReadyForFrame = false;
              });

              if (!scaledCanvasRef.current) {
                return;
              }

              const blob = await toBlob(scaledCanvasRef.current);
              if (!blob) {
                return;
              }
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
}

function CreateTab() {
  const [file, setFile] = useState<File | null>(null);

  const createGameboy = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (file) {
      const figRom = await fileToFigRom(file);
      const rom = encodeFigRom(figRom);
      sendMessage({
        type: "create gameboy",
        rom,
        name: file.name,
      });
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
    <form onSubmit={createGameboy}>
      <Stack padding={4} spacing={4}>
        <FormControl>
          <Stack spacing={4} direction="row" align="center">
            <Text fontSize="l" color="gray.700">
              {file?.name ?? "No ROM Selected"}
            </Text>
            <Button onClick={pickRom}>Select ROM</Button>
          </Stack>
        </FormControl>
        <Button type="submit" colorScheme="teal">
          Create Gameboy
        </Button>
      </Stack>
    </form>
  );
}

function PlayTab() {
  const auger = useAuger(store);
  const [isFocused, setIsFocused] = useState(() => document.hasFocus());
  useEffect(() => {
    const focus = () => setIsFocused(true);
    const blur = () => setIsFocused(false);
    window.addEventListener("focus", focus);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("focus", focus);
      window.removeEventListener("blur", blur);
    };
  }, []);
  const currentGameBoy = auger.currentGameBoy.$read();
  const [
    isEmulatorPlaying,
    updateIsEmulatorPlaying,
  ] = auger.isEmulatorPlaying.$();

  let bottomSection = null;
  if (isEmulatorPlaying) {
    bottomSection = isFocused ? <Focused /> : <NotFocused />;
  }

  return (
    <Stack spacing={4} padding={4}>
      <Text fontSize="l" color="gray.700">
        {currentGameBoy?.name ?? "No ROM Selected"}
      </Text>
      <Button
        colorScheme={isEmulatorPlaying ? "red" : "teal"}
        isDisabled={!currentGameBoy}
        onClick={async () => {
          if (isEmulatorPlaying) {
            updateIsEmulatorPlaying(() => false);
            const id = currentGameBoy?.id;
            if (!id) {
              return;
            }
            const saveState = await WasmBoy.saveState();
            sendMessage({
              type: "save state",
              id,
              state: encodeSaveState(saveState),
            });
          } else {
            updateIsEmulatorPlaying(() => true);
            WasmBoy.play();
          }
        }}
      >
        {isEmulatorPlaying ? "Pause" : "Play"}
      </Button>
      {bottomSection}
    </Stack>
  );
}

function NotFocused() {
  return (
    <Alert
      status="warning"
      variant="subtle"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      height="200px"
    >
      <AlertIcon boxSize="40px" mr={0} />
      <AlertTitle mt={4} mb={1} fontSize="lg">
        Plugin Not Focused
      </AlertTitle>
      <AlertDescription maxWidth="sm">
        You have to focus the plugin to control the GameBoy. You can click this
        box to focus.
      </AlertDescription>
    </Alert>
  );
}

const KEYS = [
  ["A", "X"],
  ["B", "Z"],
  ["UP", "UP"],
  ["DOWN", "DOWN"],
  ["LEFT", "LEFT"],
  ["RIGHT", "RIGHT"],
  ["Start", "Enter"],
  ["Select", "Backspace"],
];

function Focused() {
  return (
    <SimpleGrid borderWidth="1px" borderRadius="sm" columns={2}>
      <GridItem colSpan={2}>
        <Heading size="md" paddingY={1}>
          Controls
        </Heading>
      </GridItem>
      <Heading size="xs" paddingY={1}>
        GameBoy
      </Heading>
      <Heading size="xs" paddingY={1}>
        KeyBoard
      </Heading>
      {KEYS.map(([gb, kb]) => {
        return (
          <>
            <Badge fontSize="sm" paddingY={1}>
              {gb}
            </Badge>
            <Badge fontSize="sm" paddingY={1}>
              {kb}
            </Badge>
          </>
        );
      })}
    </SimpleGrid>
  );
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scaledCanvasRef = useRef<HTMLCanvasElement | null>(null);
  useWasmBoy(canvasRef, scaledCanvasRef);
  const auger = useAuger(store);
  const [tab, updateTab] = auger.tab.$();
  const currentGameBoy = auger.currentGameBoy.$read();
  const index = TABS.indexOf(tab);

  return (
    <ChakraProvider colorModeManager={manager}>
      <Tabs index={index} onChange={(index) => updateTab(() => TABS[index])}>
        <TabList>
          <Tab>Create</Tab>
          <Tab disabled={currentGameBoy === null}>Play</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <CreateTab />
          </TabPanel>
          <TabPanel>
            <PlayTab />
          </TabPanel>
        </TabPanels>
      </Tabs>
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
    </ChakraProvider>
  );
}

ReactDOM.render(<App />, document.getElementById("react-page"));
