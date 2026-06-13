import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { OnDestroy } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Howl } from 'howler';

const ACTION_DELAY = 700;
const MOBILE_BREAKPOINT = '(max-width: 991.98px)';

@Component({
    selector: 'ej-menu-button',
    imports: [NgOptimizedImage],
    templateUrl: './menu-button.component.html',
    styleUrl: './menu-button.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(mouseenter)': 'playSound()',
    },
})
export class MenuButtonComponent implements OnDestroy {
    readonly label = input.required<string>();
    readonly accent = input(false);
    readonly action = output<void>();

    private sound: Howl | undefined;
    private pendingAction: ReturnType<typeof setTimeout> | undefined;

    protected onClick(): void {
        if (this.pendingAction) return;

        if (globalThis.matchMedia(MOBILE_BREAKPOINT).matches) {
            this.pendingAction = setTimeout(() => {
                this.pendingAction = undefined;
                this.action.emit();
            }, ACTION_DELAY);
        } else {
            this.action.emit();
        }
    }

    protected playSound(): void {
        this.sound ??= new Howl({ src: ['assets/sound/button-50.mp3'] });
        this.sound.stop();
        this.sound.play();
    }

    ngOnDestroy(): void {
        this.sound?.unload();
        clearTimeout(this.pendingAction);
    }
}
