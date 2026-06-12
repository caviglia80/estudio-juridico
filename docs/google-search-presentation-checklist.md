# Checklist — Presentación en Google (Caviglia & Asociados)

Acciones **fuera del repo** para que Google actualice cómo se ve el sitio. El trabajo
en código (metadata, favicon SVG, JSON-LD, robots, sitemap, canonical, manifest,
Open Graph) ya está implementado; esto es lo que falta hacer en plataformas externas.

Dominio oficial: `https://cavigliayasociados.com.ar/`
Nombre de marca: **Caviglia & Asociados** · Nombre completo: **Estudio Jurídico Caviglia & Asociados**

---

## 1. Google Search Console

- [ ] Verificar propiedad del dominio (preferir propiedad de **dominio** vía DNS TXT en Cloudflare).
- [ ] Enviar el sitemap: `https://cavigliayasociados.com.ar/sitemap.xml`.
- [ ] Inspeccionar la URL de la home y **Solicitar indexación**.
- [ ] Revisar **Cobertura / Páginas**: que la home esté indexada y `/gideon` quede fuera.
- [ ] Revisar que el **canonical elegido por Google** sea `https://cavigliayasociados.com.ar/`.
- [ ] Revisar el informe de **favicon** (puede tardar días en reflejarse).
- [ ] Revisar **Mejoras / Datos estructurados** (LegalService, Organization, WebSite).
- [ ] Revisar la apariencia del **snippet** y el **site name** detectado.

## 2. Google Business Profile (Perfil de Empresa)

> Es la palanca más fuerte para entidad local + estrellas + mapa. Sin esto, Google tiene poca señal local.

- [ ] Crear o reclamar el perfil con el nombre **Estudio Jurídico Caviglia & Asociados**.
- [ ] Categoría principal: **Abogado** / **Bufete de abogados**.
- [ ] Dirección real: **Roque Vázquez 73, Junín, Buenos Aires (CP 6000)**.
- [ ] Teléfono real (WhatsApp del estudio): **+54 9 2364 65-8333**.
- [ ] Horario: **Lunes a viernes, 10:00–14:00**.
- [ ] Sitio web: `https://cavigliayasociados.com.ar/`.
- [ ] Subir logo/isotipo nuevo y fotos profesionales (no pixeladas).
- [ ] Cargar servicios/áreas (civil y comercial, laboral, familia, sucesiones, daños, etc.).
- [ ] Descripción breve y sobria.
- [ ] Pedir reseñas reales a clientes. **No inventar reseñas.**

## 3. Instagram / redes

- [ ] Avatar = isotipo nuevo (coherente con el favicon `C&A`).
- [ ] Nombre consistente: **Caviglia & Asociados**.
- [ ] Link al sitio en la bio.
- [ ] Bio con ubicación (Junín, Buenos Aires) y áreas.
- [ ] Reemplazar imágenes pixeladas/antiguas.
- [ ] Confirmar que los perfiles enlazados en `sameAs` son los oficiales:
      Facebook `https://www.facebook.com/CavigliayAsoc/` · Instagram `https://www.instagram.com/cavigliayasociados`.

## 4. Validadores (tras desplegar)

- [ ] **Rich Results Test**: https://search.google.com/test/rich-results — validar LegalService/Organization.
- [ ] **Schema Markup Validator**: https://validator.schema.org/
- [ ] **Lighthouse** (SEO + PWA) sobre la home.
- [ ] **PageSpeed Insights**: https://pagespeed.web.dev/
- [ ] **Inspección de URL / Mobile Friendly** en Search Console.
- [ ] Verificar Open Graph con el **Sharing Debugger** de Facebook y el validador de Twitter/X.

## 5. Redirecciones recomendadas (Cloudflare / Railway)

Para evitar contenido duplicado y canonical ambiguo, forzar una sola variante:

- [ ] `http://` → `https://` (Always Use HTTPS en Cloudflare).
- [ ] `www.cavigliayasociados.com.ar` → `https://cavigliayasociados.com.ar/` (o al revés, pero una sola).
- [ ] Normalizar trailing slash en la home.

---

## Pendiente del lado del repo (mejoras de assets, no bloqueantes)

Estos placeholders quedan funcionando con `logo.png` (1264×842) y el favicon SVG nuevo,
pero conviene generar assets raster dedicados cuando haya diseño disponible:

- [ ] **`favicon.ico`** multi-resolución (16/32/48) para navegadores viejos. Hoy se usa `favicon.svg` (cubre Chrome/Firefox/Edge/Google).
- [ ] **PNG cuadrados** 192×192 y 512×512 + **apple-touch-icon** 180×180 reales para el `site.webmanifest` (hoy apunta al SVG + `logo.png`).
- [ ] **Imagen Open Graph dedicada** 1200×630 (`public/og/caviglia-asociados-og.png`) con isotipo + "Estudio jurídico en Junín, Buenos Aires". Hoy `og:image` usa `logo.png`, que funciona pero no es el formato ideal del card.

## Datos: nada inventado

Todos los datos usados (dirección, email, teléfono, horario, áreas, redes) salen del repo
(`src/index.html`, `shared/utils/contact.constants.ts`, `areas-modal`). No se inventó matrícula,
años de experiencia, reseñas ni nombres de abogados que no estuvieran ya publicados.

## Recomendación futura (fuera de alcance de esta tarea)

Rediseño visual completo de la home y de los assets institucionales (logo de alta resolución,
fotografía profesional del equipo y del estudio). No se implementó aquí por ser ajeno a la
presentación en Google y por el alcance quirúrgico solicitado.
