import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ModalHeaderComponent } from '@shared/components';
import { CONTACT, CONTACT_OPTIONS } from '@shared/utils';

@Component({
    selector: 'ej-contacto-modal',
    imports: [ModalHeaderComponent],
    templateUrl: './contacto-modal.component.html',
    styleUrl: './contacto-modal.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactoModalComponent {
    protected readonly iframeCargado = signal(false);
    protected readonly contact = CONTACT;
    protected readonly abogados = CONTACT_OPTIONS;

    protected onIframeLoad(): void {
        this.iframeCargado.set(true);
    }
}
