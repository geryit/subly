// public/audio-collector.js
class AudioCollector extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const ch0 = input[0];
    if (!ch0 || ch0.length === 0) return true;
    const ch1 = input[1];
    const mono = new Float32Array(ch0.length);
    if (ch1 && ch1.length === ch0.length) {
      for (let i = 0; i < ch0.length; i++) {
        mono[i] = (ch0[i] + ch1[i]) * 0.5;
      }
    } else {
      mono.set(ch0);
    }
    // Transferable: hand the buffer off to main thread with zero copy
    this.port.postMessage({ samples: mono, sampleRate: sampleRate }, [mono.buffer]);
    return true;
  }
}
registerProcessor('audio-collector', AudioCollector);
