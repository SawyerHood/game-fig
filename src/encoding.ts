// Polyfill because QuickJS doesn't implement these
const { btoa, atob } = (function () {
  if (window.btoa && window.atob) {
    return { atob: window.atob, btoa: window.btoa };
  }
  // A helper that returns Base64 characters and their indices.
  const chars = {
    ascii() {
      return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    },
    indices() {
      if (!this.cache) {
        this.cache = {};
        var ascii = chars.ascii();

        for (var c = 0; c < ascii.length; c++) {
          var chr = ascii[c];
          this.cache[chr] = c;
        }
      }
      return this.cache;
    },
  };

  /**
   * Binary to ASCII (encode data to Base64)
   * @param {String} data
   * @returns {String}
   */
  const btoa = function (data) {
    var ascii = chars.ascii(),
      len = data.length - 1,
      i = -1,
      b64 = "";

    while (i < len) {
      var code =
        (data.charCodeAt(++i) << 16) |
        (data.charCodeAt(++i) << 8) |
        data.charCodeAt(++i);
      b64 +=
        ascii[(code >>> 18) & 63] +
        ascii[(code >>> 12) & 63] +
        ascii[(code >>> 6) & 63] +
        ascii[code & 63];
    }

    var pads = data.length % 3;
    if (pads > 0) {
      b64 = b64.slice(0, pads - 3);

      while (b64.length % 4 !== 0) {
        b64 += "=";
      }
    }

    return b64;
  };

  /**
   * ASCII to binary (decode Base64 to original data)
   * @param {String} b64
   * @returns {String}
   */
  const atob = function (b64) {
    var indices = chars.indices(),
      pos = b64.indexOf("="),
      padded = pos > -1,
      len = padded ? pos : b64.length,
      i = -1,
      data = "";

    while (i < len) {
      var code =
        (indices[b64[++i]] << 18) |
        (indices[b64[++i]] << 12) |
        (indices[b64[++i]] << 6) |
        indices[b64[++i]];
      if (code !== 0) {
        data += String.fromCharCode(
          (code >>> 16) & 255,
          (code >>> 8) & 255,
          code & 255
        );
      }
    }

    if (padded) {
      data = data.slice(0, pos - b64.length);
    }

    return data;
  };
  return { atob, btoa };
})();

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

function intArrayToString(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr));
}

function stringToIntArray(str: string): Uint8Array {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export function encodeSaveState(state: SaveState) {
  const copy: any = { ...state };
  copy.wasmboyMemory = {};
  for (const key in state.wasmboyMemory) {
    copy.wasmboyMemory[key] = intArrayToString(state.wasmboyMemory[key]);
  }

  return JSON.stringify(copy);
}

export function decodeSaveState(state: string) {
  const output = JSON.parse(state);
  for (const key in output.wasmboyMemory) {
    output.wasmboyMemory[key] = stringToIntArray(output.wasmboyMemory[key]);
  }
  return output;
}
