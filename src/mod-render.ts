/**
 * Headless helper: decode a tracker module to WAV via chiptune3 decodeAll.
 * Used by scripts/social-media/capture-filelathe-demo.mjs
 *
 *   /mod-render.html?mod=/demo/demian11.mod&max=28
 */
import { ChiptuneJsPlayer } from "chiptune3";

declare global {
  interface Window {
    __MOD_RENDER_READY__?: boolean;
    __MOD_RENDER_ERROR__?: string;
    __downloadModWav__?: () => void;
  }
}

const statusEl = document.getElementById("status");

function setStatus(msg: string) {
  if (statusEl) statusEl.textContent = msg;
  console.log(`[mod-render] ${msg}`);
}

function encodeWav(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
): Blob {
  const numFrames = Math.min(left.length, right.length);
  const dataSize = numFrames * 2 * 2; // stereo 16-bit
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 2, true); // stereo
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2 * 2, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let o = 44;
  for (let i = 0; i < numFrames; i++) {
    const l = Math.max(-1, Math.min(1, left[i] ?? 0));
    const r = Math.max(-1, Math.min(1, right[i] ?? 0));
    view.setInt16(o, (l * 0x7fff) | 0, true);
    o += 2;
    view.setInt16(o, (r * 0x7fff) | 0, true);
    o += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

async function main() {
  const params = new URLSearchParams(location.search);
  const modUrl = params.get("mod") || "/demo/demian11.mod";
  const maxSec = Math.max(1, Number(params.get("max") || "28") || 28);

  setStatus(`Fetching ${modUrl}…`);
  const res = await fetch(modUrl);
  if (!res.ok) throw new Error(`Failed to fetch mod: ${res.status}`);
  const modBuffer = await res.arrayBuffer();

  setStatus("Initializing libopenmpt…");
  const player = new ChiptuneJsPlayer({ repeatCount: 0 });

  await new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(
      () => reject(new Error("libopenmpt init timeout")),
      60_000,
    );
    player.onInitialized(() => {
      window.clearTimeout(t);
      resolve();
    });
    player.onError((err) => {
      window.clearTimeout(t);
      reject(new Error(err?.type ?? "init error"));
    });
  });

  const sampleRate = player.context.sampleRate || 48000;
  setStatus(`Decoding module @ ${sampleRate} Hz…`);

  type FullAudioMsg = {
    data?: [number[] | Float32Array, number[] | Float32Array];
    meta?: { dur?: number };
  };

  const full = await new Promise<FullAudioMsg>((resolve, reject) => {
    const t = window.setTimeout(
      () => reject(new Error("decodeAll timeout")),
      180_000,
    );
    player.onFullAudioData((msg) => {
      window.clearTimeout(t);
      resolve(msg as FullAudioMsg);
    });
    player.onError((err) => {
      window.clearTimeout(t);
      reject(new Error(err?.type ?? "decode error"));
    });
    player.decodeAll(modBuffer.slice(0));
  });

  const leftRaw = full.data?.[0];
  const rightRaw = full.data?.[1];
  if (!leftRaw?.length || !rightRaw?.length) {
    throw new Error("decodeAll returned empty audio");
  }

  const maxFrames = Math.floor(maxSec * sampleRate);
  const left = Float32Array.from(leftRaw.slice(0, maxFrames));
  const right = Float32Array.from(rightRaw.slice(0, maxFrames));
  const dur = left.length / sampleRate;
  setStatus(`Encoding WAV (${dur.toFixed(1)}s)…`);

  const wav = encodeWav(left, right, sampleRate);
  window.__downloadModWav__ = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(wav);
    a.download = "tracker-demo.wav";
    a.click();
  };
  window.__MOD_RENDER_READY__ = true;
  setStatus(`Ready — ${dur.toFixed(1)}s WAV`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  window.__MOD_RENDER_ERROR__ = msg;
  setStatus(`Error: ${msg}`);
  console.error(err);
});
