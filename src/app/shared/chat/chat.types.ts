export interface ChatMessage {
    readonly id: string;
    readonly role: 'user' | 'assistant';
    readonly content: string;
    readonly timestamp: number;
}

export interface ChatResponse {
    readonly response: string;
    readonly durationMs: number;
    readonly messages: readonly ChatMessage[];
}

export interface AudioChatResponse {
    readonly transcribedText: string;
    readonly response: string;
    readonly durationMs: number;
    readonly messages: readonly ChatMessage[];
}

export interface ChatHistory {
    readonly messages: readonly ChatMessage[];
    readonly hasMore: boolean;
}

export interface DeleteChatMessageResponse {
    readonly deletedMessageId: string;
}
