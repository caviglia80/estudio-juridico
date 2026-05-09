import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { WhatsappIconComponent } from '@shared/components/whatsapp-icon/whatsapp-icon.component';

@Component({
    selector: 'ej-contact-card',
    imports: [WhatsappIconComponent],
    templateUrl: './contact-card.component.html',
    styleUrl: './contact-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactCardComponent {
    readonly fullName = input.required<string>();
    readonly phone = input<string>();
    readonly selected = output<void>();
}
