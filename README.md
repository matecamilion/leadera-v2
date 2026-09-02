# LeadEra v2

Reescritura del CRM inmobiliario **LeadEra** (hoy Spring Boot + Angular) sobre un stack
nuevo. Repo independiente: no comparte código ni backend con
[`matecamilion/leadera`](https://github.com/matecamilion/leadera).

## Stack

| Capa      | Tecnología                                                     |
| --------- | -------------------------------------------------------------- |
| Frontend  | React 19 + Vite 8 + TypeScript 6                                 |
| Estilos   | Tailwind CSS v4 (`@tailwindcss/vite`), tokens CSS-first          |
| Ruteo     | React Router v6                                                  |
| Backend   | Supabase (PostgreSQL + Auth + Edge Functions en Deno) — proyecto nuevo |
| PWA       | `vite-plugin-pwa` (`autoUpdate`, Workbox)                        |
| Hosting   | Vercel (auto-deploy desde `main`)                                |

## Correrlo en local

Requiere **Node ≥ 20** (desarrollado con 22.20.0).

```bash
npm install
cp .env.example .env.local   # y completar con los valores del proyecto de Supabase
npm run dev                  # http://localhost:5173
```

`src/lib/supabase.ts` lanza un error explícito si faltan `VITE_SUPABASE_URL` o
`VITE_SUPABASE_ANON_KEY`. En Fase 0 ningún componente importa todavía el cliente,
así que la app levanta sin `.env.local`; en cuanto se cablee auth deja de ser opcional.

### Scripts

| Comando           | Qué hace                                          |
| ----------------- | ------------------------------------------------- |
| `npm run dev`     | Servidor de desarrollo con HMR                    |
| `npm run build`   | Type-check (`tsc -b`) + build de producción        |
| `npm run preview` | Sirve `dist/` — única forma de probar el SW real   |
| `npm run lint`    | oxlint                                             |

## Estructura

```
src/
├── components/     Componentes compartidos (AppLayout, PagePlaceholder)
├── hooks/          Custom hooks (useAuth, useAgente)
├── lib/
│   ├── supabase.ts Cliente de Supabase desde env vars
│   └── theme.ts    Design tokens en TS (espejo de index.css)
├── pages/          Una página por ruta
├── types/
│   ├── index.ts    Entidades del dominio (Lead, Agente, Propiedad, Operacion)
│   └── database.ts Tipos generados de Supabase (placeholder)
├── App.tsx         Definición de rutas
├── index.css       Tailwind + design tokens (@theme)
├── main.tsx        Bootstrap de React
└── pwa.ts          Registro del service worker
```

## Sistema de diseño

Los tokens viven en `src/index.css` bajo `@theme` y son la **única fuente de verdad**.
Tailwind v4 genera las utilidades automáticamente a partir de ellos.

| Token                | Valor     | Uso                        |
| -------------------- | --------- | -------------------------- |
| `--color-primary`    | `#0F6E5C` | `bg-primary`, `text-primary` |
| `--color-background` | `#F7F8FA` | `bg-background`            |
| `--color-surface`    | `#FFFFFF` | `bg-surface`               |
| `--color-ink`        | `#1A1F24` | `text-ink`                 |
| `--font-sans`        | Inter     | `font-sans`                |

Inter se sirve self-hosted vía `@fontsource-variable/inter`, no desde Google Fonts:
así entra al precache del service worker y la PWA funciona offline.

**Regla:** nada de hex sueltos en componentes. Si falta un color, se agrega como token.
`src/lib/theme.ts` replica los valores para el código que necesita un hex desde JS
(meta tags, gráficos, librerías de terceros).

## PWA

- `registerType: 'autoUpdate'` — una versión nueva toma control sin preguntar.
- `registerSW({ immediate: true })` en `src/pwa.ts` (por eso `injectRegister: null`).
- Workbox precachea el app shell y usa `navigateFallback: '/index.html'` para el SPA.
- Las respuestas de Supabase **no** se cachean en el SW: son datos autenticados y por usuario.

El service worker no corre en `npm run dev` (`devOptions.enabled: false`).
Para probarlo: `npm run build && npm run preview`.

## Estado

**Fase 0 — bootstrap.** Esqueleto de rutas y sistema de diseño. Sin lógica de negocio,
sin auth real, sin pantallas funcionales. El proyecto de Supabase todavía no está creado.
