import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ModalService } from '@shared/modal/modal.service';
import { CONTACT, openExternal } from '@shared/utils';
import { AbogadosModalComponent, ABOGADOS_MODAL_CONFIG } from '@shared/components/abogados-modal/abogados-modal.component';
import { WhatsappIconComponent } from '@shared/components/whatsapp-icon/whatsapp-icon.component';

@Component({
    selector: 'ej-social-buttons',
    imports: [WhatsappIconComponent],
    templateUrl: './social-buttons.component.html',
    styleUrl: './social-buttons.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialButtonsComponent {
    private readonly modalService = inject(ModalService);

    protected openInstagram(): void {
        openExternal(CONTACT.instagramUrl);
    }

    protected openFacebook(): void {
        openExternal(CONTACT.facebookUrl);
    }

    protected openAbogados(): void {
        this.modalService.open(AbogadosModalComponent, ABOGADOS_MODAL_CONFIG);
    }
}
