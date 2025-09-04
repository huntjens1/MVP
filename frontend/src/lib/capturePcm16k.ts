// Start/stop microfoon capture via AudioWorklet naar 16kHz Int16 PCM
export type MicStopper = () => Promise<void>;

export async function startMicPcm16k(
  ws: WebSocket,
  opts?: { onError?: (e: Error) => void }
): Promise<MicStopper> {
  const onErr = (e: any) => opts?.onError?.(e instanceof Error ? e : new Error(String(e)));

  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: 48000, // browser default, we resamplen naar 16000
  });

  try {
    await audioCtx.audioWorklet.addModule(new URL('./pcm16k-worklet-processor.js', import.meta.url));
  } catch (e) {
    onErr(new Error('AudioWorklet niet beschikbaar: ' + String(e)));
    // Fallback naar ScriptProcessor (laatste redmiddel)
    return legacyScriptProcessor(ws, stream, audioCtx, onErr);
  }

  const source = audioCtx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(audioCtx, 'pcm16k-writer');

  node.port.onmessage = (ev: MessageEvent<Int16Array>) => {
    if (ws.readyState === ws.OPEN) {
      const buf = ev.data;
      ws.send(buf.buffer);
    }
  };

  source.connect(node);
  node.connect(audioCtx.destination); // stil output pad, nodig om graph actief te houden

  const stop: MicStopper = async () => {
    try { source.disconnect(); } catch {}
    try { node.disconnect(); } catch {}
    try { node.port.close(); } catch {}
    try { stream.getTracks().forEach(t => t.stop()); } catch {}
    try { await audioCtx.close(); } catch {}
  };
  return stop;
}

function legacyScriptProcessor(
  ws: WebSocket,
  stream: MediaStream,
  audioCtx: AudioContext,
  onErr: (e: any) => void
): MicStopper {
  const source = audioCtx.createMediaStreamSource(stream);
  const sp = audioCtx.createScriptProcessor(4096, 1, 1);

  sp.onaudioprocess = (ev: AudioProcessingEvent) => {
    try {
      const input = ev.inputBuffer.getChannelData(0);
      // zeer eenvoudige downsample 48k -> 16k (decimate by 3)
      const outLen = Math.floor(input.length / 3);
      const out = new Int16Array(outLen);
      for (let i = 0, j = 0; i < outLen; i++, j += 3) {
        const s = Math.max(-1, Math.min(1, input[j]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      if (ws.readyState === ws.OPEN) ws.send(out.buffer);
    } catch (e) {
      onErr(e);
    }
  };

  source.connect(sp);
  sp.connect(audioCtx.destination);

  const stop: MicStopper = async () => {
    try { source.disconnect(); } catch {}
    try { sp.disconnect(); } catch {}
    try { stream.getTracks().forEach(t => t.stop()); } catch {}
    try { await audioCtx.close(); } catch {}
  };
  return stop;
}
