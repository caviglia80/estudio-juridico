import type { ContactOption } from './contact.types';

export const CONTACT = {
    email: 'estudiocavigliayasoc@fibertel.com.ar',
    address: 'Roque Vázquez 73, Junín, Buenos Aires',
    hours: '10:00–14:00 h',
    instagramUrl: 'https://www.instagram.com/cavigliayasociados',
    facebookUrl: 'https://www.facebook.com/CavigliayAsoc/',
} as const;

export const CONTACT_OPTIONS: ContactOption[] = [
    { fullName: 'Ramiro', tel: '5492364658333', displayPhone: '+54 9 2364 65-8333' },
    { fullName: 'Gaston', tel: '5492364643542', displayPhone: '+54 9 2364 64-3542' },
    { fullName: 'Octavio', tel: '5492364678472', displayPhone: '+54 9 2364 67-8472' },
];
