/** Tipos del modo voz realtime (protocolo WS con Gideon) */

export type VoiceCallState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'ended';

export interface VoiceReadyMessage {
    readonly type: 'ready';
    readonly modelId: string;
    readonly modelLabel: string;
}

export interface VoiceStateMessage {
    readonly type: 'state';
    readonly value: 'listening' | 'thinking' | 'speaking';
}

export interface VoicePartialTranscriptMessage {
    readonly type: 'partial_transcript';
    readonly text: string;
}

export interface VoiceUserTurnMessage {
    readonly type: 'user_turn';
    readonly text: string;
}

export interface VoiceSpeakTextMessage {
    readonly type: 'speak_text';
    readonly text: string;
}

export interface VoiceAssistantDoneMessage {
    readonly type: 'assistant_done';
    readonly text: string;
}

export interface VoiceInterruptedMessage {
    readonly type: 'interrupted';
}

export interface VoiceErrorMessage {
    readonly type: 'error';
    readonly message: string;
    readonly fatal: boolean;
}

export type VoiceServerMessage =
    | VoiceReadyMessage
    | VoiceStateMessage
    | VoicePartialTranscriptMessage
    | VoiceUserTurnMessage
    | VoiceSpeakTextMessage
    | VoiceAssistantDoneMessage
    | VoiceInterruptedMessage
    | VoiceErrorMessage;
