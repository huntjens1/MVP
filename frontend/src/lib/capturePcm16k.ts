// frontend/src/lib/capturePcm16k.ts
export type MicStopper = () => Promise<void>;

/**
 * Start de microfoon, downsample naar 16kHz mono PCM (16-bit),
 * en stuur frames (Float32 -> Int16) naar de gegeven WebSocket.
 * Retourneert een async stop-functie die netjes alles opruimt.
 */
export async function startMicPcm16k(ws: WebSocket): Promise<MicStopper> {
  if (ws.readyState !== WebSocket.OPEN) {
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener("error", () => reject(new Error("ws error")), {
        once: true,
      });
    });
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ac = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: 16000,
  });

  const source = ac.createMediaStreamSource(stream);
  const processor = ac.createScriptProcessor(4096, 1, 1);

  source.connect(processor);
  processor.connect(ac.destination);

  processor.onaudioprocess = (ev) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const input = ev.inputBuffer.getChannelData(0);
    const buf = new ArrayBuffer(input.length * 2);
    const view = new DataView(buf);
    for (let i = 0; i < input.length; i++) {
      let s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    ws.send(buf);
  };

  const stop: MicStopper = async () => {
    try {
      processor.onaudioprocess = null;
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      if (ac.state !== "closed") await ac.close();
    } catch {
      /* ignore */
    }
  };

  return stop;
}
