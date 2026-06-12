import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

import { VoiceCallService } from '@shared/voice';

/** Overlay de llamada de voz realtime: estado, transcripción en vivo y controles */
@Component({
    selector: 'ej-voice-call-overlay',
    imports: [NgOptimizedImage],
    templateUrl: './voice-call-overlay.component.html',
    styleUrl: './voice-call-overlay.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceCallOverlayComponent {
    protected readonly voice = inject(VoiceCallService);

    protected readonly stateLabel = computed(() => {
        switch (this.voice.state()) {
            case 'connecting': return 'Conectando…';
            case 'listening': return 'Te escucho…';
            case 'thinking': return 'Pensando…';
            case 'speaking': return 'Hablando';
            default: return '';
        }
    });

    protected readonly elapsed = computed(() => {
        const total = this.voice.elapsedSeconds();
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    });
}
