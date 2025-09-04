/* @ts-nocheck */
/**
 * PCM16KProcessor
 * - Resamplet input (meestal 48 kHz) naar 16 kHz mono
 * - Buffert tot FRAME_SAMPLES (320 = ~20ms) en post pas dan
 * - Stuurt Int16 little-endian chunks terug naar main thread
 */
class PCM16KProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inSampleRate = sampleRate;  // door AudioContext gezet
    this.outSampleRate = 16000;
    this.ratio = this.inSampleRate / this.outSampleRate;

    this.FRAME_SAMPLES = 320; // 20ms @16kHz
    this.parts = [];          // verzameling Int16Array stukjes
    this.totalLen = 0;        // totaal aantal samples in parts
  }

  static get parameterDescriptors() {
    return [];
  }

  _append(int16arr) {
    if (!int16arr || int16arr.length === 0) return;
    this.parts.push(int16arr);
    this.totalLen += int16arr.length;
  }

  _drainExact(n) {
    // Neem exact n samples uit parts en retourneer nieuwe Int16Array(n)
    const out = new Int16Array(n);
    let filled = 0;
    while (filled < n && this.parts.length) {
      const head = this.parts[0];
      const need = n - filled;
      if (head.length <= need) {
        out.set(head, filled);
        filled += head.length;
        this.parts.shift();
      } else {
        out.set(head.subarray(0, need), filled);
        this.parts[0] = head.subarray(need); // rest terug
        filled += need;
      }
    }
    this.totalLen -= n;
    return out;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const ch = input[0]; // neem kanaal 0
    // Resample 48k -> 16k met eenvoudige lineaire interpolatie
    const outLen = Math.floor(ch.length / this.ratio);
    const out = new Int16Array(outLen);

    for (let i = 0; i < outLen; i++) {
      const idx = i * this.ratio;
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, ch.length - 1);
      const frac = idx - i0;
      const s = ch[i0] * (1 - frac) + ch[i1] * frac; // float [-1,1]
      const clamped = Math.max(-1, Math.min(1, s));
      out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }

    // Buffer dit stukje en post alleen in 320-sample frames
    this._append(out);
    while (this.totalLen >= this.FRAME_SAMPLES) {
      const frame = this._drainExact(this.FRAME_SAMPLES);
      // postMessage + transfer buffer
      this.port.postMessage(frame, [frame.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm16k-writer', PCM16KProcessor);
