import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '@env/environment';

import { AuthService } from '@shared/auth';
import type { VoiceCallState, VoiceServerMessage } from './voice.types';

const WORKLET_URL = 'voice-worklet.js';
const LEVEL_UPDATE_MS = 90;

/**
 * Llamada de voz realtime con Gideon.
 * Captura el micrófono (AudioWorklet → PCM16 16 kHz → WS binario), recibe la voz
 * de Gideon como frames MP3 por oración y los reproduce sin huecos. El servidor
 * maneja turnos e interrupciones; acá solo se refleja el estado y se corta la
 * reproducción local cuando avisa `interrupted`.
 */
@Injectable({ providedIn: 'root' })
export class VoiceCallService {
    private readonly auth = inject(AuthService);

    readonly state = signal<VoiceCallState>('idle');
    readonly partialTranscript = signal('');
    readonly speakingText = signal('');
    readonly modelLabel = signal('');
    readonly errorMessage = signal<string | null>(null);
    readonly elapsedSeconds = signal(0);
    readonly micLevel = signal(0);
    readonly active = computed(() => this.state() !== 'idle' && this.state() !== 'ended');

    private socket: WebSocket | null = null;
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private analyser: AnalyserNode | null = null;
    private levelTimer: ReturnType<typeof setInterval> | null = null;
    private callTimer: ReturnType<typeof setInterval> | null = null;
    private startedAt = 0;
    private nextPlayTime = 0;
    private decodeChain: Promise<void> = Promise.resolve();
    private readonly activeSources = new Set<AudioBufferSourceNode>();

    /** Inicia la llamada; `model` es el id del selector del chat */
    async start(model?: string): Promise<void> {
        if (this.active()) return;

        this.resetSignals();
        this.state.set('connecting');

        try {
            await this.setupAudio();
            this.connectSocket(model);
        } catch {
            this.errorMessage.set('No se pudo acceder al micrófono. Verificá los permisos del navegador.');
            this.teardown('ended');
        }
    }

    /** Cuelga la llamada (limpieza completa) */
    hangUp(): void {
        if (this.state() === 'idle') return;
        this.sendJson({ type: 'stop' });
        this.teardown('ended');
    }

    /** Corta a Gideon sin colgar (el usuario quiere hablar ya) */
    interrupt(): void {
        this.sendJson({ type: 'interrupt' });
        this.flushPlayback();
    }

    /** El componente confirma que procesó el fin de llamada (p. ej. recargó historial) */
    acknowledgeEnd(): void {
        if (this.state() === 'ended') {
            this.state.set('idle');
        }
    }

    // ── Audio: captura ───────────────────────────────────────────────────

    private async setupAudio(): Promise<void> {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });

        const ctx = new AudioContext();
        this.audioContext = ctx;
        await ctx.resume();
        await ctx.audioWorklet.addModule(WORKLET_URL);

        const source = ctx.createMediaStreamSource(this.mediaStream);
        this.workletNode = new AudioWorkletNode(ctx, 'voice-capture');
        this.workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
            if (this.socket?.readyState === WebSocket.OPEN) {
                this.socket.send(event.data);
            }
        };

        // El worklet necesita estar en el grafo hacia destination para que el UA lo procese
        const silentSink = ctx.createGain();
        silentSink.gain.value = 0;
        source.connect(this.workletNode);
        this.workletNode.connect(silentSink);
        silentSink.connect(ctx.destination);

        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
        this.startLevelLoop();
    }

    private startLevelLoop(): void {
        const data = new Uint8Array(this.analyser?.frequencyBinCount ?? 0);
        this.levelTimer = setInterval(() => {
            if (!this.analyser) return;
            this.analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (const value of data) {
                const centered = (value - 128) / 128;
                sum += centered * centered;
            }
            const rms = Math.sqrt(sum / data.length);
            this.micLevel.set(Math.min(1, rms * 4));
        }, LEVEL_UPDATE_MS);
    }

    // ── WebSocket ────────────────────────────────────────────────────────

    private connectSocket(model?: string): void {
        const token = this.auth.token();
        if (!token) {
            this.errorMessage.set('Sesión expirada.');
            this.teardown('ended');
            return;
        }

        const wsBase = environment.gideonBaseUrl.replace(/^http/, 'ws');
        const socket = new WebSocket(`${wsBase}/api/webchat/voice?token=${encodeURIComponent(token)}`);
        socket.binaryType = 'arraybuffer';
        this.socket = socket;

        socket.onopen = () => {
            this.sendJson({ type: 'start', ...(model ? { model } : {}) });
        };
        socket.onmessage = (event: MessageEvent) => {
            if (typeof event.data === 'string') {
                this.handleServerMessage(event.data);
            } else if (event.data instanceof ArrayBuffer) {
                this.enqueueAudio(event.data);
            }
        };
        socket.onerror = () => {
            if (this.active()) {
                this.errorMessage.set('Se cortó la conexión de voz.');
            }
        };
        socket.onclose = () => {
            if (this.active()) {
                this.teardown('ended');
            }
        };
    }

    private handleServerMessage(raw: string): void {
        let message: VoiceServerMessage;
        try {
            message = JSON.parse(raw) as VoiceServerMessage;
        } catch {
            return;
        }

        switch (message.type) {
            case 'ready':
                this.modelLabel.set(message.modelLabel);
                this.startedAt = Date.now();
                this.callTimer = setInterval(() => {
                    this.elapsedSeconds.set(Math.floor((Date.now() - this.startedAt) / 1000));
                }, 1000);
                break;
            case 'state':
                this.state.set(message.value);
                if (message.value === 'listening') this.speakingText.set('');
                break;
            case 'partial_transcript':
                this.partialTranscript.set(message.text);
                break;
            case 'user_turn':
                this.partialTranscript.set('');
                break;
            case 'speak_text':
                this.speakingText.set(message.text);
                break;
            case 'assistant_done':
                this.speakingText.set('');
                break;
            case 'interrupted':
                this.flushPlayback();
                this.speakingText.set('');
                break;
            case 'error':
                this.errorMessage.set(message.message);
                if (message.fatal) this.teardown('ended');
                break;
        }
    }

    private sendJson(payload: Record<string, unknown>): void {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(payload));
        }
    }

    // ── Audio: reproducción gapless por oración ──────────────────────────

    private enqueueAudio(buffer: ArrayBuffer): void {
        // Encadenar las decodificaciones preserva el orden de las oraciones
        this.decodeChain = this.decodeChain
            .then(async () => this.playChunk(buffer))
            .catch(() => undefined);
    }

    private async playChunk(buffer: ArrayBuffer): Promise<void> {
        const ctx = this.audioContext;
        if (!ctx || !this.active()) return;

        const audio = await ctx.decodeAudioData(buffer);
        if (!this.active()) return;

        const source = ctx.createBufferSource();
        source.buffer = audio;
        source.connect(ctx.destination);

        const startAt = Math.max(ctx.currentTime + 0.02, this.nextPlayTime);
        source.start(startAt);
        this.nextPlayTime = startAt + audio.duration;

        this.activeSources.add(source);
        source.onended = () => this.activeSources.delete(source);
    }

    private flushPlayback(): void {
        for (const source of this.activeSources) {
            try { source.stop(); } catch { /* ya detenida */ }
        }
        this.activeSources.clear();
        this.nextPlayTime = 0;
        this.decodeChain = Promise.resolve();
    }

    // ── Limpieza ─────────────────────────────────────────────────────────

    private teardown(finalState: VoiceCallState): void {
        this.flushPlayback();

        if (this.levelTimer) { clearInterval(this.levelTimer); this.levelTimer = null; }
        if (this.callTimer) { clearInterval(this.callTimer); this.callTimer = null; }

        this.workletNode?.port.close();
        this.workletNode = null;
        this.analyser = null;

        this.mediaStream?.getTracks().forEach(track => track.stop());
        this.mediaStream = null;

        if (this.socket) {
            const socket = this.socket;
            this.socket = null;
            socket.onclose = null;
            try { socket.close(1000); } catch { /* ya cerrado */ }
        }

        if (this.audioContext) {
            void this.audioContext.close().catch(() => undefined);
            this.audioContext = null;
        }

        this.micLevel.set(0);
        this.state.set(finalState);
    }

    private resetSignals(): void {
        this.partialTranscript.set('');
        this.speakingText.set('');
        this.modelLabel.set('');
        this.errorMessage.set(null);
        this.elapsedSeconds.set(0);
        this.micLevel.set(0);
        this.nextPlayTime = 0;
    }
}
