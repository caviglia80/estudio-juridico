/**
 * AudioWorklet de captura para el modo voz del chat.
 * Convierte el audio del micrófono (Float32, sample rate nativa del contexto)
 * a PCM16 mono 16 kHz y lo emite en chunks de 800 muestras (50 ms), el formato
 * que consume AssemblyAI Universal-Streaming del lado del servidor.
 */

const TARGET_RATE = 16000;
const CHUNK_SAMPLES = 800; // 50 ms a 16 kHz
const RING_SIZE = 32768;

class VoiceCaptureProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.ring = new Float32Array(RING_SIZE);
        this.writePos = 0; // posición absoluta de escritura
        this.readPos = 0; // posición absoluta de lectura (fraccional, avanza a paso `step`)
        this.step = sampleRate / TARGET_RATE;
        this.out = new Int16Array(CHUNK_SAMPLES);
        this.outLen = 0;
    }

    process(inputs) {
        const block = inputs[0] && inputs[0][0];
        if (!block) {
            return true;
        }

        for (let i = 0; i < block.length; i++) {
            this.ring[this.writePos % RING_SIZE] = block[i];
            this.writePos++;
        }

        // Remuestreo lineal: consumir mientras haya par de muestras disponible
        while (this.readPos + 1 < this.writePos) {
            const idx = Math.floor(this.readPos);
            const frac = this.readPos - idx;
            const a = this.ring[idx % RING_SIZE];
            const b = this.ring[(idx + 1) % RING_SIZE];
            const sample = a + (b - a) * frac;

            const clamped = Math.max(-1, Math.min(1, sample));
            this.out[this.outLen++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

            if (this.outLen === CHUNK_SAMPLES) {
                const chunk = this.out.slice();
                this.port.postMessage(chunk.buffer, [chunk.buffer]);
                this.outLen = 0;
            }

            this.readPos += this.step;
        }

        return true;
    }
}

registerProcessor('voice-capture', VoiceCaptureProcessor);
