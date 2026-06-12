import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '@env/environment';

import type { ChatHistory, ChatResponse, DeleteChatMessageResponse, AudioChatResponse } from './chat.types';

const REQUEST_TIMEOUT = 60_000;

@Injectable({ providedIn: 'root' })
export class ChatService {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = `${environment.gideonBaseUrl}/api/webchat`;

    async sendMessage(message: string): Promise<ChatResponse> {
        return firstValueFrom(
            this.http.post<ChatResponse>(`${this.baseUrl}/messages`, { message }).pipe(
                timeout(REQUEST_TIMEOUT),
            ),
        );
    }

    async sendAudio(audioBase64: string): Promise<AudioChatResponse> {
        return firstValueFrom(
            this.http.post<AudioChatResponse>(`${this.baseUrl}/messages/audio`, { audioBase64 }).pipe(
                timeout(120_000),
            ),
        );
    }

    async getHistory(): Promise<ChatHistory> {
        return firstValueFrom(
            this.http.get<ChatHistory>(`${this.baseUrl}/messages`).pipe(
                timeout(REQUEST_TIMEOUT),
            ),
        );
    }

    async clearHistory(): Promise<void> {
        await firstValueFrom(
            this.http.delete(`${this.baseUrl}/history`).pipe(
                timeout(REQUEST_TIMEOUT),
            ),
        );
    }

    async deleteMessage(messageId: string): Promise<DeleteChatMessageResponse> {
        return firstValueFrom(
            this.http.delete<DeleteChatMessageResponse>(`${this.baseUrl}/messages/${encodeURIComponent(messageId)}`).pipe(
                timeout(REQUEST_TIMEOUT),
            ),
        );
    }
}
