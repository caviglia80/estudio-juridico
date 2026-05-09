# CLAUDE.md — Estudio Jurídico Caviglia & Asociados

Guía operativa para Claude Code en este repo. Contesta SIEMPRE en español.

## Proyecto

Sitio web institucional del estudio jurídico (Junín, Buenos Aires). SPA con landing, modales de contacto/áreas/consulta y un chat asistente ("Gideon") protegido por login.

## Stack

- **Framework**: Angular 21 standalone, **zoneless** (`provideZonelessChangeDetection`). Sin NgModules, sin `zone.js`.
- **Lenguaje**: TypeScript estricto (`strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noUncheckedSideEffectImports`, `erasableSyntaxOnly`).
- **Build**: `@angular/build:application` (esbuild).
- **UI**: Bootstrap 5.3 + bootstrap-icons, sistema propio de modales en `shared/modal/`.
- **Markdown**: `ngx-markdown` (chat).
- **Audio**: `howler`.
- **HTTP/Auth**: `HttpClient` + interceptor de Bearer token, JWT en `localStorage`.
- **Package manager**: `pnpm`.

## Comandos

```bash
pnpm start            # ng serve (dev, host 0.0.0.0)
pnpm build            # ng build --configuration dev
pnpm build:prod       # ng build --configuration prod (defaultConfiguration)
pnpm lint             # ng lint (eslint + angular-eslint + sonarjs)
```

No hay tests ni framework de testing configurado.

## Estructura

```
src/
  main.ts                          # bootstrapApplication
  index.html                       # SEO + JSON-LD LegalService + fonts
  styles.scss                      # globales: vars, modal overlay, markdown del chat
  environments/                    # environment.ts | environment.prod.ts (gideonBaseUrl)
  app/
    app.config.ts                  # providers: zoneless, http+interceptor, router, markdown
    app.routes.ts                  # '' (home, lazy), 'gideon' (chat, lazy + authGuard)
    app.component.ts/html/scss     # root: router-outlet + social buttons (oculto en /gideon)
    features/
      home/                        # landing
        home.component.{ts,html,scss}
        areas-modal/               # áreas de práctica
        consulta-modal/            # botones que disparan WhatsApp prerellenado
        contacto-modal/            # mapa, dirección, lista de abogados, email
        login-modal/               # auth (la única clave es la del estudio)
        change-password-modal/     # cambio de clave (reusa estilos de login)
        settings-modal/            # menú con cambiar clave / cerrar sesión
      chat/
        chat.component.{ts,html,scss}
        delete-message-modal/      # confirmación de borrado de mensaje
    shared/
      auth/                        # AuthService (signals), authGuard, authInterceptor
      chat/                        # ChatService (timeout 60s) + ChatTypes
      components/                  # piezas reutilizables (ej-prefix)
        abogados-modal/            # selector de contacto WhatsApp; acepta WHATSAPP_TEXT por DI
        area-card/, card-button/, contact-card/, menu-button/
        modal-header/              # header reutilizable con botón cerrar (a11y)
        social-buttons/            # FAB IG/FB/WhatsApp
        whatsapp-icon/             # SVG inline parametrizable
      modal/                       # ModalService propio (overlay, focus trap, escape)
      utils/
        contact.constants.ts       # CONTACT (email, address, hours, social) + CONTACT_OPTIONS
        contact.types.ts
        social.utils.ts            # openExternal, buildWhatsappUrl
        http-error.utils.ts        # httpErrorMessage(err) → string en español
```

### Path aliases (tsconfig)

```
@shared/*  →  src/app/shared/*
@env/*     →  src/environments/*
```

Solo estos dos están activos. No agregar nuevos sin un caso real.

## Convenciones de código

### Generales

- **DRY** y **SRP**. Complejidad cognitiva ≤ 10 por función.
- Eliminar código muerto al detectarlo (imports, símbolos, clases CSS).
- Mínimo comentario; código autodocumentado. Solo comentar el "por qué" no obvio.
- Sin `console.*` en código final (lint lo bloquea).
- Sin `any`. `unknown` solo cuando se justifica + type-narrow explícito.
- Sin `!` (non-null assertion), sin `ts-ignore`/`ts-expect-error`, sin `eslint-disable`.

### Angular

- **Standalone components**, sin `standalone: true` (es default en v21+).
- `changeDetection: ChangeDetectionStrategy.OnPush` SIEMPRE.
- `input()` / `output()` (no `@Input`/`@Output`). Queries con `viewChild()`/`contentChild()`.
- Estado con **signals**; derivados con `computed`. Para async usar `firstValueFrom` + `signal` o `toSignal`.
- `inject()` en lugar de constructor injection.
- Servicios singleton: `@Injectable({ providedIn: 'root' })`.
- Routing con lazy-loading (`loadComponent`).
- Templates: `@if` / `@for` / `@switch` (no `*ngIf`/`*ngFor`). Sin `ngClass`/`ngStyle` — bindings `[class.x]`/`[style.x]`.
- `NgOptimizedImage` para imágenes estáticas no inline.
- Imágenes/sonidos en `src/assets/`.
- Evitar `@HostBinding`/`@HostListener` — usar la opción `host` del decorador.
- `protected` para miembros usados solo en el template; `private readonly` para deps inyectadas.

### Modales

- Abrir con `ModalService.open(Component, ModalConfig)`. El modal recibe un `MODAL_REF` por DI; `inject(MODAL_REF).close()` lo cierra.
- Para pasar datos al modal usar `providers: [{ provide: TOKEN, useValue }]` en el `ModalConfig`.
- Cada modal incluye `<ej-modal-header title="…" />` (gestiona `aria-labelledby` y botón cerrar).
- Para confirmaciones, el modal expone una función `settle(confirmed: boolean)` por token; el llamador la envuelve en una `Promise` (ver `chat.component.ts → confirmDeleteMessage`).
- El `ModalService` ya implementa overlay, focus trap, restauración de foco, cierre por Escape y por clic fuera.

### Estilos

- SCSS por componente; estilos globales en `src/styles.scss`.
- Sin `::ng-deep` ni `:deep()`. Para estilar contenido inyectado por `innerHTML` (markdown del chat), usar selectores globales en `styles.scss` con prefijo del host (`ej-chat .chat-bubble-assistant …`).
- CSS custom properties: `--color-wsp`, `--color-fb`, `--color-text`, `--color-icon-default`.
- Budget de estilos por componente: warning 10 kB / error 12 kB (ver `angular.json`).

### Accesibilidad

- Pasar AXE; respetar WCAG AA (foco, contraste, ARIA).
- `aria-label`/`aria-hidden` en SVGs y botones icónicos.
- `role="dialog"` y `aria-modal` ya los aplica el `ModalService`.

## Datos y entornos

- Backend ("Gideon"): `environment.gideonBaseUrl` (mismo valor en dev y prod).
- Endpoints: `/api/auth/login`, `/api/auth/change-password`, `/api/webchat/messages`, `/api/webchat/history`.
- Token JWT en `localStorage` (`ej_auth_token`). El interceptor agrega `Authorization: Bearer …`.
- Datos de contacto en `shared/utils/contact.constants.ts`. Mantener `CONTACT_OPTIONS` (Ramiro/Gaston/Octavio) sincronizados con el JSON-LD de `index.html` y la dirección/email.

## Workflow de cambios

1. Implementar el cambio aplicando las convenciones.
2. Borrar lo que quede sin uso (símbolos, clases CSS, imports).
3. `pnpm lint` — resolver TODO error y warning.
4. `pnpm build:prod` — debe pasar sin warnings (incluido budget de estilos).
5. Verificar manualmente la pantalla impactada (`pnpm start`).
6. No introducir tests ni dependencias de testing.

## Notas de comportamiento esperadas

- En `/` (home) se muestran los botones flotantes de IG/FB/WhatsApp; en `/gideon` quedan ocultos (`AppComponent.showSocial`).
- El selector de contactos (`abogados-modal`) abre `wa.me/<tel>` — opcionalmente con texto prerellenado vía `WHATSAPP_TEXT` (lo provee `consulta-modal` por DI).
- `MenuButtonComponent` reproduce un click-sound (`assets/sound/button-50.mp3`) en hover/focus y, en mobile, retrasa la acción 700 ms para que se oiga.
- El chat hace auto-scroll al final salvo que el usuario haya hecho scroll manual hacia arriba (umbral de 80 px).

## Qué NO hacer

- No reintroducir `@app/*` ni `@pages/*` en `tsconfig.json` (ya removidos por estar sin uso).
- No reintroducir el teléfono fijo del estudio: dejó de usarse.
- No agregar Angular Material / NgModules / Zone.js.
- No usar `console.*`, `any`, `!`, `ts-ignore`, `eslint-disable`.
- No documentar lo obvio. Comentar solo el "por qué" cuando no se deduce del código.
