import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import type { ElementRef, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AsyncPipe, NgOptimizedImage } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '@shared/auth';
import { ChatService, type AudioChatResponse, type ChatMessage, type ChatModel, type ChatTurnMetadata } from '@shared/chat';
import { VoiceCallService } from '@shared/voice';
import { ModalService } from '@shared/modal';
import { httpErrorMessage } from '@shared/utils';
import { MarkdownPipe } from 'ngx-markdown';

import { DELETE_MESSAGE_MODAL_DATA } from './delete-message-modal/delete-message-modal.token';
import { DeleteMessageModalComponent, DELETE_MESSAGE_MODAL_CONFIG } from './delete-message-modal/delete-message-modal.component';
import { VoiceCallOverlayComponent } from './voice-call-overlay/voice-call-overlay.component';

interface DisplayMessage {
    readonly id: string;
    readonly serverId: string | null;
    readonly role: 'user' | 'assistant';
    readonly content: string;
    readonly timestamp: number;
    readonly pending: boolean;
    /** Modelo/proveedor que REALMENTE generó esta respuesta (medido en el backend). Solo en
     *  respuestas del asistente generadas en esta sesión; el historial cargado no lo trae. */
    readonly respondedModel?: string;
    readonly respondedProvider?: string;
    readonly outputTokens?: number;
}

const MAX_MESSAGE_LENGTH = 4000;
const TEXTAREA_MAX_HEIGHT = 120;
const MODEL_STORAGE_KEY = 'gideon-chat-model';

@Component({
    selector: 'ej-chat',
    imports: [MarkdownPipe, AsyncPipe, NgOptimizedImage, VoiceCallOverlayComponent],
    templateUrl: './chat.component.html',
    styleUrl: './chat.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements OnInit, OnDestroy {
    private readonly auth = inject(AuthService);
    private readonly chat = inject(ChatService);
    private readonly modal = inject(ModalService);
    private readonly router = inject(Router);
    protected readonly voice = inject(VoiceCallService);
    private readonly messagesContainer = viewChild<ElementRef<HTMLElement>>('messagesRef');
    private readonly inputRef = viewChild<ElementRef<HTMLTextAreaElement>>('inputRef');

    protected readonly messages = signal<DisplayMessage[]>([]);
    protected readonly input = signal('');
    protected readonly sending = signal(false);
    protected readonly loading = signal(false);
    protected readonly error = signal<string | null>(null);
    protected readonly historyFailed = signal(false);
    protected readonly showScrollButton = signal(false);
    protected readonly copiedMessageId = signal<string | null>(null);
    protected readonly deletingMessageId = signal<string | null>(null);
    protected readonly recording = signal(false);
    protected readonly models = signal<readonly ChatModel[]>([]);
    protected readonly selectedModelId = signal<string | null>(null);
    protected readonly showModelSelector = computed(() => this.models().length > 1);
    protected readonly maxLength = MAX_MESSAGE_LENGTH;
    protected readonly canSend = computed(() => {
        const text = this.input().trim();
        return text.length > 0 && text.length <= MAX_MESSAGE_LENGTH && !this.sending();
    });

    private shouldAutoScroll = true;
    private messageIdSeq = 0;
    private copyResetTimer: ReturnType<typeof setTimeout> | undefined;
    private mediaRecorder: MediaRecorder | undefined;
    private audioChunks: Blob[] = [];

    constructor() {
        afterRenderEffect(() => {
            this.messages();
            if (this.shouldAutoScroll) {
                this.scrollToBottom();
            }
        });
        // Al terminar una llamada, traer los turnos de voz persistidos al hilo del chat
        // (y conservar el motivo si se cortó por error, ya que el overlay desaparece)
        effect(() => {
            if (this.voice.state() === 'ended') {
                const voiceError = this.voice.errorMessage();
                if (voiceError) {
                    this.error.set(voiceError);
                }
                this.voice.acknowledgeEnd();
                void this.loadHistory();
            }
        });
    }

    ngOnInit(): void {
        void this.loadHistory();
        void this.loadModels();
    }

    ngOnDestroy(): void {
        clearTimeout(this.copyResetTimer);
        if (this.mediaRecorder && this.recording()) {
            this.mediaRecorder.stop();
        }
        if (this.voice.active()) {
            this.voice.hangUp();
        }
    }

    protected startVoiceCall(): void {
        if (this.sending() || this.recording() || this.voice.active()) return;
        void this.voice.start(this.selectedModelId() ?? undefined);
    }

    protected async send(): Promise<void> {
        const text = this.input().trim();
        if (!text || text.length > MAX_MESSAGE_LENGTH || this.sending()) return;

        const pendingMessage = this.createPendingMessage(text);

        this.input.set('');
        this.resetTextareaHeight();
        this.error.set(null);
        this.shouldAutoScroll = true;
        this.messages.update(msgs => [...msgs, pendingMessage]);
        this.sending.set(true);

        try {
            const result = await this.chat.sendMessage(text, this.selectedModelId() ?? undefined);
            if (result.messages.length === 0) {
                // El backend no persistió el turno (error de sistema, rate-limit, etc.): el texto del
                // problema viene en `response` y `messages` vacío. No descartar el mensaje del usuario
                // en silencio — restaurar el input y mostrar el aviso para que pueda reintentar.
                this.messages.update(msgs => msgs.filter(msg => msg.id !== pendingMessage.id));
                this.setInputValue(text);
                this.error.set(this.unpersistedTurnMessage(result.response));
                return;
            }
            this.messages.update(msgs => {
                const withoutPending = msgs.filter(msg => msg.id !== pendingMessage.id);
                const persistedMessages = result.messages.map(message => this.toDisplayMessage(message, message.role === 'assistant' ? result.metadata : undefined));
                return [...withoutPending, ...persistedMessages];
            });
            this.scrollToBottomDeferred();
        } catch (err: unknown) {
            this.messages.update(msgs => msgs.filter(msg => msg.id !== pendingMessage.id));
            this.setInputValue(text);
            this.error.set(this.toErrorMessage(err));
        } finally {
            this.sending.set(false);
            this.inputRef()?.nativeElement.focus();
        }
    }

    protected async toggleRecording(): Promise<void> {
        if (this.recording()) {
            this.mediaRecorder?.stop();
            return;
        }

        this.error.set(null);
        this.audioChunks = [];

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            this.error.set('No se pudo acceder al micrófono. Verificá los permisos del navegador.');
            return;
        }

        const recorder = new MediaRecorder(stream);
        this.mediaRecorder = recorder;

        recorder.ondataavailable = (event: BlobEvent) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        recorder.onstop = () => {
            stream.getTracks().forEach(track => track.stop());
            this.recording.set(false);
            void this.submitAudio();
        };

        recorder.start();
        this.recording.set(true);
    }

    private async submitAudio(): Promise<void> {
        if (this.audioChunks.length === 0) return;

        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioChunks = [];
        this.sending.set(true);
        this.shouldAutoScroll = true;

        try {
            const arrayBuffer = await blob.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuffer);
            let binary = '';
            for (const byte of uint8) {
                binary += String.fromCharCode(byte);
            }
            const audioBase64 = btoa(binary);
            const result: AudioChatResponse = await this.chat.sendAudio(audioBase64);
            if (result.messages.length === 0) {
                // Sin turno persistido (fallo de transcripción o de IA): avisar sin tocar el historial.
                this.error.set(this.unpersistedTurnMessage(result.response));
                return;
            }
            this.messages.update(msgs => [...msgs, ...result.messages.map(msg => this.toDisplayMessage(msg, msg.role === 'assistant' ? result.metadata : undefined))]);
            this.scrollToBottomDeferred();
        } catch (err: unknown) {
            this.error.set(this.toErrorMessage(err));
        } finally {
            this.sending.set(false);
        }
    }

    protected onModelChange(event: Event): void {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) { return; }

        const modelId = target.value;
        if (!this.models().some(model => model.id === modelId)) { return; }

        this.selectedModelId.set(modelId);
        try {
            localStorage.setItem(MODEL_STORAGE_KEY, modelId);
        } catch {
            // localStorage no disponible (modo privado estricto) — la selección vive solo en la sesión
        }
    }

    protected onKeydown(event: KeyboardEvent): void {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void this.send();
        }
    }

    protected onInput(textarea: HTMLTextAreaElement): void {
        this.input.set(textarea.value);
        this.resizeTextarea(textarea);
    }

    protected onScroll(): void {
        const el = this.messagesContainer()?.nativeElement;
        if (!el) return;
        const threshold = 80;
        const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
        this.shouldAutoScroll = isAtBottom;
        this.showScrollButton.set(!isAtBottom);
    }

    protected scrollToBottom(): void {
        const el = this.messagesContainer()?.nativeElement;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
        this.shouldAutoScroll = true;
        this.showScrollButton.set(false);
    }

    private scrollToBottomDeferred(): void {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.scrollToBottom();
            });
        });
    }

    protected dismissError(): void {
        this.error.set(null);
    }

    protected async copyMessage(message: DisplayMessage): Promise<void> {
        try {
            await this.writeToClipboard(message.content);
            this.setCopiedMessage(message.id);
        } catch {
            this.error.set('No se pudo copiar el mensaje al portapapeles.');
        }
    }

    protected async deleteMessage(message: DisplayMessage): Promise<void> {
        if (message.pending || this.deletingMessageId() !== null) { return; }
        if (!message.serverId) {
            this.error.set('No se puede borrar este mensaje porque no tiene identificador persistido.');
            return;
        }

        const shouldDelete = await this.confirmDeleteMessage();
        if (!shouldDelete) { return; }

        this.error.set(null);
        this.deletingMessageId.set(message.id);

        try {
            const result = await this.chat.deleteMessage(message.serverId);
            this.messages.update(messages => messages.filter(item => item.serverId !== result.deletedMessageId));
            if (this.copiedMessageId() === message.id) {
                this.copiedMessageId.set(null);
            }
        } catch (err: unknown) {
            this.error.set(this.toErrorMessage(err));
        } finally {
            this.deletingMessageId.set(null);
        }
    }

    protected isCopied(messageId: string): boolean {
        return this.copiedMessageId() === messageId;
    }

    protected isDeleting(messageId: string): boolean {
        return this.deletingMessageId() === messageId;
    }

    protected canDeleteMessage(message: DisplayMessage): boolean {
        return !message.pending && message.serverId !== null && this.deletingMessageId() === null;
    }

    protected goBack(): void {
        void this.router.navigate(['/']);
    }

    protected async clearChat(): Promise<void> {
        try {
            await this.chat.clearHistory();
            this.messages.set([]);
        } catch (err: unknown) {
            this.error.set(this.toErrorMessage(err));
        }
    }

    protected async retryLoadHistory(): Promise<void> {
        this.historyFailed.set(false);
        this.error.set(null);
        await this.loadHistory();
    }

    private async loadModels(): Promise<void> {
        try {
            const response = await this.chat.getModels();
            this.models.set(response.models);
            this.selectedModelId.set(this.resolveInitialModel(response.models, response.defaultModelId));
        } catch {
            // Sin lista de modelos el selector no se muestra y el backend usa su default
            this.models.set([]);
            this.selectedModelId.set(null);
        }
    }

    private resolveInitialModel(models: readonly ChatModel[], defaultModelId: string): string {
        let stored: string | null = null;
        try {
            stored = localStorage.getItem(MODEL_STORAGE_KEY);
        } catch {
            stored = null;
        }

        if (stored && models.some(model => model.id === stored)) {
            return stored;
        }

        return defaultModelId;
    }

    private async loadHistory(): Promise<void> {
        this.loading.set(true);
        try {
            const history = await this.chat.getHistory();
            this.messages.set(history.messages.map((message: ChatMessage) => this.toDisplayMessage(message)));
            this.scrollToBottomDeferred();
            this.historyFailed.set(false);
        } catch (err: unknown) {
            this.historyFailed.set(true);
            this.error.set(this.toErrorMessage(err));
        } finally {
            this.loading.set(false);
        }
    }

    private toDisplayMessage(message: ChatMessage, metadata?: ChatTurnMetadata): DisplayMessage {
        const serverId = this.normalizeServerId(message.id);
        const isAssistant = message.role === 'assistant';

        return {
            id: serverId ?? `legacy-${++this.messageIdSeq}`,
            serverId,
            role: isAssistant ? 'assistant' : 'user',
            content: message.content,
            timestamp: message.timestamp,
            pending: false,
            // El metadata medido se asocia solo a la respuesta del asistente del turno actual
            ...(isAssistant && metadata
                ? { respondedModel: metadata.model, respondedProvider: metadata.provider, outputTokens: metadata.outputTokens }
                : {}),
        };
    }

    private createPendingMessage(content: string): DisplayMessage {
        return {
            id: `pending-${++this.messageIdSeq}`,
            serverId: null,
            role: 'user',
            content,
            timestamp: Date.now(),
            pending: true,
        };
    }

    private normalizeServerId(messageId: string | null | undefined): string | null {
        if (typeof messageId !== 'string') { return null; }

        const trimmedMessageId = messageId.trim();
        return trimmedMessageId === '' ? null : trimmedMessageId;
    }

    private resetTextareaHeight(): void {
        const el = this.inputRef()?.nativeElement;
        if (el) { el.style.height = 'auto'; }
    }

    private setInputValue(value: string): void {
        this.input.set(value);
        const el = this.inputRef()?.nativeElement;
        if (!el) { return; }
        el.value = value;
        this.resizeTextarea(el);
    }

    private resizeTextarea(el: HTMLTextAreaElement): void {
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
    }

    private async writeToClipboard(text: string): Promise<void> {
        const clipboard = globalThis.navigator?.clipboard;
        if (clipboard) {
            await clipboard.writeText(text);
            return;
        }

        throw new Error('Clipboard API no disponible');
    }

    private confirmDeleteMessage(): Promise<boolean> {
        return new Promise(resolve => {
            const settle = (confirmed: boolean): void => resolve(confirmed);

            this.modal.open(DeleteMessageModalComponent, {
                ...DELETE_MESSAGE_MODAL_CONFIG,
                providers: [{ provide: DELETE_MESSAGE_MODAL_DATA, useValue: { settle } }],
            });
        });
    }

    private setCopiedMessage(messageId: string): void {
        this.copiedMessageId.set(messageId);
        clearTimeout(this.copyResetTimer);
        this.copyResetTimer = setTimeout(() => this.copiedMessageId.set(null), 1400);
    }

    /** Nombre corto del modelo que respondió (ej. "Sonnet 4.6"); si no está en la lista,
     *  muestra el id crudo — señal visible de que respondió algo inesperado. */
    protected respondedModelLabel(message: DisplayMessage): string {
        const id = message.respondedModel;
        if (!id) { return ''; }
        return this.models().find(model => model.id === id)?.shortLabel ?? id;
    }

    private toErrorMessage(err: unknown): string {
        if (err instanceof HttpErrorResponse && err.status === 401) {
            this.auth.logout();
            void this.router.navigate(['/']);
            return 'Sesión expirada.';
        }
        if (err instanceof HttpErrorResponse && err.status === 404) {
            return 'El mensaje ya no está disponible.';
        }
        return httpErrorMessage(err);
    }

    /** Mensaje a mostrar cuando el backend devolvió respuesta pero no persistió el turno */
    private unpersistedTurnMessage(response: string): string {
        const trimmed = response.trim();
        return trimmed.length > 0 ? trimmed : 'No se pudo procesar el mensaje. Probá de nuevo.';
    }
}
