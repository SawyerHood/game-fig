import { bytesToBase64, base64ToBytes } from "byte-base64";

type SaveState = {
  date: number;
  isAuto: boolean;
  wasmboyMemory: {
    cartridgeRam: Uint8Array;
    gameBoyMemory: Uint8Array;
    wasmBoyInternalState: Uint8Array;
    wasmBoyPaletteMemory: Uint8Array;
  };
};

export function encodeSaveState(state: SaveState) {
  const copy: any = { ...state };
  copy.wasmboyMemory = {};
  for (const key in state.wasmboyMemory) {
    copy.wasmboyMemory[key] = bytesToBase64(state.wasmboyMemory[key]);
  }

  return JSON.stringify(copy);
}

export function decodeSaveState(state: string) {
  const output = JSON.parse(state);
  for (const key in output.wasmboyMemory) {
    output.wasmboyMemory[key] = base64ToBytes(output.wasmboyMemory[key]);
  }
  return output;
}

export type FigRom = {
  name: string;
  rom: Uint8Array;
};

// Note this only works in the UI code
export async function fileToFigRom(file: File): Promise<FigRom> {
  const buffer = await file.arrayBuffer();
  const rom = new Uint8Array(buffer);
  return {
    name: file.name,
    rom,
  };
}

export function encodeFigRom(figRom: FigRom): string {
  return JSON.stringify({
    ...figRom,
    rom: bytesToBase64(figRom.rom),
  });
}

export function decodeFigRom(str: string): FigRom {
  const res = JSON.parse(str);
  res.rom = base64ToBytes(res.rom);
  return res;
}
