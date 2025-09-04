/* @ts-nocheck */
// AudioWorkletProcessor die naar 16kHz mono resamplet en Int16 PCM chunks post
class PCM16KProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inSampleRate = sampleRate; // AudioContext sample rate (bijv. 48000)
    this.outSampleRate = 16000;
    this.ratio = this.inSampleRate / this.outSampleRate;
    this.buffer = [];
    this.bufferPos = 0;
  }

  static get parameterDescriptors() {
    return [];
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0]; // mono mix van kanaal 0
    const outLen = Math.floor(ch.length / this.ratio);
    const out = new Int16Array(outLen);

    let pos = 0;
    let i = 0;
    // eenvoudige resample (decimatie + lineaire interp)
    while (i < outLen) {
      const idx = i * this.ratio;
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, ch.length - 1);
      const frac = idx - i0;
      const sample = ch[i0] * (1 - frac) + ch[i1] * frac;
      // float32 [-1,1] -> int16
      const s = Math.max(-1, Math.min(1, sample));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      i++;
    }

    // Chunks van ca. 20ms (320 samples) verzenden
    const CHUNK = 320;
    for (let p = 0; p < out.length; p += CHUNK) {
      const slice = out.subarray(p, Math.min(p + CHUNK, out.length));
      this.port.postMessage(slice, [slice.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm16k-writer', PCM16KProcessor);
