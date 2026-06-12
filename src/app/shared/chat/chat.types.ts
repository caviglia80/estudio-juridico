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

export interface ChatModel {
    readonly id: string;
    /** Nombre corto para el selector (ej: "Gemma4", "Sonnet 4.6") */
    readonly shortLabel: string;
    readonly label: string;
    readonly description: string;
    readonly provider: string;
    readonly tier: string;
    readonly isDefault: boolean;
}

export interface ChatModelsResponse {
    readonly models: readonly ChatModel[];
    readonly defaultModelId: string;
}
