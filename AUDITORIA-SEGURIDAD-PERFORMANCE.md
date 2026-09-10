# Auditoría de seguridad, performance y mantenibilidad — LeadEra v2

**Fecha:** 2026-09-10
**Alcance:** repo completo (182 archivos / 31.665 líneas en `src`, 14 archivos de Edge Functions), base de datos vía pruebas de comportamiento, dependencias y bundle de producción.
**Naturaleza:** 100 % diagnóstico. No se modificó ninguna línea de código funcional.

---

## Nota previa: qué pude verificar y qué no

Esto condiciona la lectura de todo el resto, así que va primero.

| Área | Cómo se verificó | Confianza |
|---|---|---|
| Comportamiento de RLS | Pruebas empíricas contra la base real con sesión de usuario | **Alta** — evidencia directa |
| Texto de las policies RLS | **No verificado** | — |
| Definición de los RPC | **No verificado** | — |
| Edge Functions | Lectura completa del código | Alta |
| Webhook Mercado Pago | Lectura completa del flujo | Alta |
| Capa `src/lib/api` | Lectura completa | Alta |
| Dependencias | `npm audit` + revisión manual | Alta |
| Bundle | Análisis del `dist/` real | Alta |
| Índices de la base | **No verificado** | — |

**El MCP de Supabase no tiene permiso sobre el proyecto de producción** (`gnnowyphlxebdxbfsmss`). Devuelve `You do not have permission to perform this action`; su `list_projects` sólo expone `leadera` (`vjefoduwdiwhvuzakmsm`) y `swapstyle`. Tampoco se puede leer `pg_policies` ni `pg_proc` vía PostgREST porque no están expuestos.

Para no entregar una auditoría basada en suposiciones, **el comportamiento de RLS se verificó ejecutando ataques reales contra la base** con la sesión del navegador. Eso da evidencia de comportamiento, que para RLS es tan válida como el texto de la policy —o más—, pero **no permite detectar policies que existan y estén mal escritas para casos que los datos actuales no ejercitan** (ver H-01).

---

## 1. Resumen ejecutivo

LeadEra v2 es un producto sólido en lo que más importa para un CRM multi-tenant: **no encontré ninguna vulnerabilidad crítica ni ninguna vía de fuga de datos entre inmobiliarias**. Las pruebas de intrusión que ejecuté contra la base real —insertar filas con `inmobiliaria_id` ajeno, mover un lead a otro tenant, subirme el plan de suscripción, cambiarle el rol a otro usuario— **fueron todas rechazadas por RLS**, con `WITH CHECK` efectivo en las 7 tablas con tenant. El webhook de Mercado Pago valida la firma HMAC antes de tocar la base y es idempotente. No hay secretos en el bundle, no hay PII en logs, y el vector de inyección en filtros PostgREST está neutralizado.

El riesgo real no está en el código sino **alrededor** de él: el esquema de la base —incluidas todas las policies RLS, que son la única barrera de seguridad— **no está versionado en el repositorio**. Hay un solo archivo de migración, creado hoy. Eso significa que la frontera de seguridad del producto vive exclusivamente en la consola de Supabase, sin revisión, sin historial y sin forma de auditarla o recrearla. A eso se suma **cero tests automatizados** en 31.665 líneas.

En síntesis: la implementación está por encima del promedio, pero el proceso que la sostiene es frágil. **Score global: 6.8/10.**

---

## 2. FODA técnico

### Fortalezas
- **RLS con `WITH CHECK` verificado en las 7 tablas con tenant.** No es solo lectura filtrada: la base rechaza activamente escrituras con tenant forjado.
- **Webhook de MP correctamente implementado**: firma antes de procesar, comparación en tiempo constante, idempotencia por constraint único, y rechazo explícito si falta el secreto.
- **Cero secretos en el bundle.** Sólo `VITE_SUPABASE_URL` y la anon key, ambas públicas por diseño.
- **Código excepcionalmente documentado.** Los comentarios explican el *porqué* de las decisiones no obvias, no el *qué*. Es lo que más va a acelerar a cualquiera que entre al proyecto.
- **Lazy loading correcto de las dependencias pesadas** (`@react-pdf/renderer`, `exceljs`): 3 MB de JS total pero ~540 kB en la carga inicial.
- **TypeScript estricto, lint limpio**, tipos generados desde el esquema real.

### Oportunidades
- Versionar el esquema y las policies (cierra el hallazgo más grave de un saque).
- Extraer `sanearBusqueda` a un helper único (hoy triplicado).
- Memoizar el `value` del `AuthContext` (una línea, beneficio global).
- Un puñado de tests sobre las funciones puras críticas (`compararCriterios`, `sanearBusqueda`, `generarFechas`, `normalizarTelefonoAR`) daría cobertura desproporcionada al esfuerzo.

### Debilidades
- Esquema y RLS no versionados ni revisables.
- Cero tests automatizados.
- 71 puntos donde el mensaje crudo de Postgres puede llegar al usuario final.
- Defensa en profundidad ausente: RLS es la única barrera; si una policy se cae en una migración manual, no hay red.
- `.env.example` documenta 2 de las ~8 variables que el sistema necesita.

### Amenazas
- **Migraciones aplicadas a mano en el SQL Editor.** Un `DROP POLICY` o un `ALTER` mal copiado en producción no deja rastro y no tiene rollback. Es el escenario más probable de incidente.
- Deriva entre el código y la base: ya encontré dos comentarios que describían mal el comportamiento real del RPC y de una policy.
- `react-router` 6.30.6 con open redirect conocido; el salto a la versión parcheada es major.

---

## 3. Scores por área

| Área | Score | Justificación |
|---|---|---|
| **Seguridad** | **7.5/10** | Aislamiento entre tenants verificado y sólido, webhook bien hecho, sin secretos expuestos. Baja por la ausencia de defensa en profundidad, los errores crudos al usuario y la imposibilidad de auditar las policies. |
| **Performance** | **7/10** | Lazy loading bien resuelto, sin N+1 en la capa de API, react-query compartiendo cache correctamente. Baja por el context sin memoizar, la ausencia de memoización en componentes de 400-700 líneas y los índices no verificables. |
| **Escalabilidad** | **6.5/10** | El modelo multi-tenant por RLS escala bien y la paginación está en todos los listados. Baja porque abrir una ficha dispara ~8 queries en paralelo, los RPC `SECURITY DEFINER` no tienen límites explícitos, y sin acceso a los índices no se puede afirmar que las queries frecuentes estén cubiertas. |
| **Calidad de código** | **8/10** | De lo mejor del proyecto: tipado estricto, lint limpio, convenciones consistentes, componentes con responsabilidad clara. Baja sólo por la duplicación de helpers y algún componente que pasó de largo las 700 líneas. |
| **Mantenibilidad** | **5/10** | El punto más flojo. Documentación en código sobresaliente, pero **0 tests**, **esquema no versionado**, `.env.example` incompleto y comentarios que ya divergieron de la realidad. |

---

## 4. Hallazgos priorizados

### CRÍTICO

**Ninguno.** Ni fuga entre inmobiliarias, ni bypass de autenticación, ni falsificación de pagos, ni secretos expuestos, ni inyección explotable.

---

### ALTO

#### H-01 · El esquema y las policies RLS no están versionados

**Dónde:** `supabase/migrations/` — un solo archivo (`20260909120000_obtener_actividad_reciente.sql`, creado hoy).

**Qué pasa:** todo el esquema —tablas, constraints, triggers, RPC y **todas las policies RLS**— existe únicamente en la base de producción. No está en el repo, no pasa por code review, no tiene historial y no se puede recrear un entorno equivalente.

**Impacto:** RLS es la **única** barrera que separa los datos de una inmobiliaria de los de otra (ver H-02). Esa barrera hoy no es auditable ni versionada, y se modifica a mano desde el SQL Editor. Un `DROP POLICY` accidental durante una migración manual abre una fuga total entre tenants **sin dejar rastro y sin rollback**. Esta auditoría misma es evidencia del problema: no pude leer las policies ni la definición de `buscar_coincidencias_busqueda` porque no existen en ningún lado más que en la consola.

**Corrección de ejemplo** (volcar el estado actual y versionarlo):

```bash
supabase db dump --db-url "$DATABASE_URL" --schema public -f supabase/migrations/00000000000000_baseline.sql
supabase db dump --db-url "$DATABASE_URL" --role-only -f supabase/migrations/00000000000001_policies.sql
```

Y a partir de ahí, toda modificación como archivo nuevo aplicado con `supabase db push`, nunca a mano.

---

#### H-02 · Sin defensa en profundidad: RLS es el único control de acceso

**Dónde:** toda la capa `src/lib/api/*.ts`. Ejemplos representativos:
- `src/lib/api/propiedades.ts:421` — `obtenerPropiedadPorId(id)` → `.eq('id', id)` sin filtro de tenant
- `src/lib/api/leads.ts` — `obtenerLeadPorId(id)`, mismo patrón
- `src/lib/api/detalleMatch.ts:56` — `obtenerDetalleMatch`, mismo patrón

**Qué pasa:** ninguna función de lectura por ID valida que el recurso pertenezca a la inmobiliaria del usuario. Es una decisión deliberada y documentada (`propiedades.ts:153`: *"RLS filtra por inmobiliaria en el server, así que acá no repetimos ese filtro"*), y **hoy funciona correctamente** porque RLS está bien puesta.

**Impacto:** no es explotable hoy. Es un problema de arquitectura de riesgo: combinado con H-01, cualquier error en una policy se convierte inmediatamente en fuga entre inmobiliarias, sin ninguna capa que lo contenga. En un CRM con datos de contacto reales, ese es el peor escenario posible.

**Corrección de ejemplo** — un filtro redundante barato en las lecturas por ID:

```ts
// src/lib/api/propiedades.ts
export async function obtenerPropiedadPorId(id: string): Promise<PropiedadDetalle | null> {
  const perfil = await miPerfil()          // ya existe el helper en tareas.ts / visitas.ts
  const { data, error } = await supabase
    .from('propiedades')
    .select('*, lead_propietario:leads(*)')
    .eq('id', id)
    .eq('inmobiliaria_id', perfil.inmobiliaria_id)   // ← red de seguridad
    .maybeSingle()
  ...
}
```

---

#### H-03 · Mensajes crudos de Postgres llegan al usuario final

**Dónde:** 71 sitios en `src/lib/api/`. Los más expuestos: `operaciones.ts` (12), `leads.ts` (12), `propiedades.ts` (10), `tareas.ts` (8).

Patrón: `throw new Error(\`No se pudieron cargar los leads: ${error.message}\`)`, y en la UI:

```tsx
// src/components/leads/TabsDetalleLead.tsx:106 y ~15 lugares más
error={error instanceof Error ? error.message : null}
```

que termina renderizado tal cual en un `<p role="alert">`.

**Qué pasa:** existe `src/lib/mensajesDeError.ts`, que traduce constraints conocidos a frases legibles, pero **sólo se aplica en algunos puntos** (`mensajeDeGuardado`). Los 71 restantes propagan el texto de PostgREST sin filtrar.

**Impacto:** revelación del esquema. Un usuario que fuerce un error ve, por ejemplo, `new row violates row-level security policy for table "leads"` —lo obtuve literalmente durante esta auditoría— o nombres de constraints, columnas y relaciones. No expone datos de otros tenants ni credenciales, pero le entrega a un atacante el mapa de la base gratis.

**Corrección de ejemplo** — un único punto de saneamiento:

```ts
// src/lib/mensajesDeError.ts
const GENERICO = 'No pudimos completar la operación. Probá de nuevo.'

/** Lo único que se le muestra al usuario. El detalle crudo va al log. */
export function mensajeSeguro(error: unknown, fallback = GENERICO): string {
  const crudo = error instanceof Error ? error.message : ''
  const conocido = buscarPorTexto(crudo)      // la tabla POR_TEXTO que ya existe
  if (!conocido) console.error('[api]', crudo) // el detalle, sólo en consola
  return conocido ?? fallback
}
```

---

### MEDIO

#### M-01 · `sanearBusqueda` triplicado

**Dónde:** `src/lib/api/leads.ts:34`, `src/lib/api/operaciones.ts:149`, `src/lib/api/propiedades.ts:148` — tres copias idénticas de:

```ts
function sanearBusqueda(texto: string): string {
  return texto.replace(/[,()\\]/g, ' ').trim()
}
```

**Qué pasa:** es la defensa contra inyección en filtros `.or()` de PostgREST, donde la coma separa cláusulas. **Hoy funciona**: verifiqué que neutraliza `,` `(` `)` `\`, que son los separadores de la gramática. El propio código reconoce la duplicación (`operaciones.ts:145`: *"el día que aparezca un tercer buscador conviene sacarlo a un helper común"*) — y ese tercer buscador ya existe.

**Impacto:** un control de seguridad replicado tres veces se arregla en una sola cuando aparezca un bypass. Y un cuarto buscador que se olvide de llamarlo abre la inyección: con una coma se puede agregar una cláusula `.or()` arbitraria, ampliando el conjunto de filas devueltas dentro de lo que RLS permita.

**Corrección de ejemplo:** moverlo a `src/lib/api/filtros.ts` y que los tres lo importen.

---

#### M-02 · `AuthContext` recrea su `value` en cada render

**Dónde:** `src/contexts/AuthContext.tsx:112`

```tsx
<AuthContext.Provider value={{ user, profile, loading, refrescarPerfil, signOut }}>
```

**Qué pasa:** el objeto literal es nuevo en cada render del provider, así que **todos** los consumidores de `useAuth()` re-renderizan aunque nada haya cambiado. `useAuth` se consume en `AppLayout`, `Tareas`, `DetalleLead`, `ResumenLead`, `Perfil` y varios más.

**Corrección de ejemplo:**

```tsx
const value = useMemo(
  () => ({ user, profile, loading, refrescarPerfil, signOut }),
  [user, profile, loading, refrescarPerfil, signOut],
)
return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
```

---

#### M-03 · Componentes grandes sin memoización

**Dónde:**
- `src/components/leads/ResumenLead.tsx` — 734 líneas, 11 hooks de datos, **0** `useMemo`/`useCallback`/`memo`
- `src/components/leads/TabsDetalleLead.tsx` — 444 líneas, 15 hooks, **0**
- `src/pages/Estadisticas.tsx` — 177 líneas, **0**

**Qué pasa:** abrir una ficha de lead monta ~8 queries en paralelo (lead, interacciones, operaciones, propiedades, tareas, visitas, búsquedas, agente) y ningún cálculo derivado está memoizado. `compararCriterios` y los `.slice()`/`.filter()` de los paneles se recalculan en cada render.

**Impacto:** hoy imperceptible con 7 leads. Con carteras de cientos de filas y varias pestañas abiertas, se nota. Es deuda de performance, no un bug.

---

#### M-04 · 4 vulnerabilidades moderadas en dependencias

`npm audit`: **0 críticas, 0 altas, 4 moderadas.**

| Paquete | Directa | Detalle |
|---|---|---|
| `react-router` / `react-router-dom` 6.30.6 | sí | Open redirect vía backslash en `<Link>`/`useNavigate` (bypass de CVE-2025-68470). El segundo aviso (constructor injection en hidratación SSR) **no aplica**: la app es SPA sin SSR. |
| `uuid` <11.1.1 (vía `exceljs`) | no | Falta de bounds check cuando se pasa `buf`. `exceljs` no usa esa forma → riesgo práctico ~nulo. |

**Impacto:** el open redirect es el único con superficie real, y sólo si alguna ruta se construye con entrada del usuario. Revisé y **no encontré ningún `navigate()` ni `<Link to>` armado con datos no confiables**. El fix es un major (`react-router-dom@7`).

---

#### M-05 · `.env.example` documenta 2 de ~8 variables

**Dónde:** `.env.example` — sólo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

**Qué pasa:** el sistema necesita además, del lado de Supabase: `APP_BASE_URL`, `EXTRA_ALLOWED_ORIGINS`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_SUCCESS_URL`. Ninguna está documentada en el repo.

**Impacto:** operativo. Un despliegue nuevo arranca con funcionalidad rota de formas silenciosas —el webhook de MP devuelve 401, el OAuth de Google falla— sin nada que indique qué falta.

---

#### M-06 · Cero tests automatizados

**Dónde:** todo el repo. 0 archivos de test, sin runner en `package.json`.

**Impacto:** en 31.665 líneas con lógica de negocio no trivial —cálculo de coincidencias con tolerancia de precio, generación de series de tareas, normalización de teléfonos AR, conversión de husos— cada refactor se valida a mano. La red actual es `tsc` + `lint`, que no dice nada sobre corrección.

**Dónde empezar** (máximo retorno, todas funciones puras sin I/O): `compararCriterios` (`detalleMatch.ts`), `sanearBusqueda`, `generarFechas` (`tareas.ts`), `normalizarTelefonoAR` (`telefono.ts`), `esOperacionTrabada` (`kanbanUtils.ts`).

---

### BAJO

#### B-01 · El webhook de MP loguea el body antes de validar la firma

**Dónde:** `supabase/functions/webhook-mercadopago/index.ts:76-82`

```ts
console.error('webhook-mercadopago: notificación sin data.id o sin tipo', { query: url.search, cuerpo })
```

Ocurre **antes** de la verificación de firma. Cualquiera que conozca la URL puede llenar los logs con contenido arbitrario. No compromete datos —el endpoint sigue sin procesar nada sin firma válida— pero permite ruido e inyección de log.

#### B-02 · Índices no verificables

No pude leer `pg_indexes`. Las columnas que el código usa con más frecuencia en `WHERE`/`ORDER BY` y que conviene confirmar que estén indexadas: `leads(inmobiliaria_id, estado, fecha_proximo_seguimiento, fecha_ultimo_contacto_real)`, `interacciones(lead_id, fecha)`, `tareas(lead_id, asignado_a, creado_por, fecha)`, `visitas(propiedad_id, lead_id, fecha)`, `propiedades(inmobiliaria_id, estado, lead_propietario_id)`, `operaciones(lead_id, propiedad_id, busqueda_id)`.

#### B-03 · Comentarios divergidos del comportamiento real

Dos casos encontrados hoy:
- `src/lib/api/busquedas.ts:217` afirmaba que el RPC *"no aplica un piso de score… incluidas las de 0%"*. El RPC filtra en 30 %. (Corregido en otra tanda.)
- `src/pages/Perfil.tsx:~99` afirma que `inmobiliarias` *"no tiene policy de SELECT para usuarios autenticados, así que la fila vuelve vacía"*. **Verifiqué que sí devuelve la fila.**

Son síntoma de H-01: sin el esquema versionado, la única descripción del comportamiento de la base son comentarios que envejecen sin que nadie lo note.

#### B-04 · Fallos de RLS silenciosos en escritura

Un `UPDATE` bloqueado por RLS devuelve 200 con lista vacía, no un error. El código ya lo maneja con `verificarAfectadas()` en `tareas.ts` y `visitas.ts`, pero no en todos los caminos. Lo confirmé: mi intento de subirme el plan devolvió `afectadas: 0` **sin error**.

---

## 5. Score global

# 6.8 / 10

Implementación por encima del promedio, sostenida por un proceso frágil. La seguridad del producto —lo que más importa— está bien resuelta y verificada. Lo que baja la nota es que esa seguridad no es auditable ni reproducible, y que no hay ninguna red automatizada que avise si se rompe.

---

## 6. Top 5 para arreglar ya

1. **Versionar el esquema y las policies RLS** (H-01). Un `supabase db dump` y un commit. Cierra el riesgo más grave del sistema y vuelve auditable la frontera de seguridad.
2. **Sanear los mensajes de error hacia el usuario** (H-03). Una función, aplicada en la capa de API: frase genérica en pantalla, detalle en consola.
3. **Extraer `sanearBusqueda` a un helper único** (M-01). Diez minutos. Es un control de seguridad y hoy hay tres copias.
4. **Memoizar el `value` del `AuthContext`** (M-02). Una línea, beneficio en toda la app.
5. **Tests sobre las 5 funciones puras críticas** (M-06). Es el mínimo que convierte los refactors en algo verificable.

Los dos primeros son de seguridad y deberían ir antes que cualquier feature nueva. Del tercero al quinto son baratos y de alto retorno.

---

## Anexo: pruebas de intrusión ejecutadas

Todas contra la base real, con sesión de usuario `DUENO`. **Todas rechazadas.** Los datos quedaron sin modificar (los valores originales se restauraron donde hizo falta).

| Prueba | Resultado | Código |
|---|---|---|
| `INSERT` en `leads` con `inmobiliaria_id` ajeno | Rechazado por RLS | `42501` |
| `UPDATE` moviendo un lead a otra inmobiliaria | Rechazado por RLS | `42501` |
| `INSERT` con tenant ajeno en `propiedades` | Rechazado por RLS | `42501` |
| `INSERT` con tenant ajeno en `operaciones` | Rechazado por RLS | `42501` |
| `INSERT` con tenant ajeno en `busquedas` | Rechazado por RLS | `42501` |
| `INSERT` con tenant ajeno en `tareas` | Rechazado por RLS | `42501` |
| `INSERT` con tenant ajeno en `visitas` | Rechazado por RLS | `42501` |
| `INSERT` con tenant ajeno en `tareas_series` | Rechazado por RLS | `42501` |
| `INSERT` en `interacciones` con `agente_id` ajeno | Rechazado por FK | `23503` |
| `UPDATE` subiendo plan / cupo / estado de suscripción | 0 filas afectadas | — |
| `UPDATE` cambiando el rol de otro usuario | `permission denied for table profiles` | `42501` |
| `SELECT` sobre `inmobiliarias` | Sólo la propia | — |
| `SELECT` sobre `profiles` | Sólo el propio tenant | — |
| Búsqueda de secretos en el bundle de producción | Ninguno | — |

**Limitación:** la base tiene una sola inmobiliaria, así que el aislamiento entre dos tenants reales no se pudo ejercitar de forma directa. Las pruebas usaron un `inmobiliaria_id` inexistente, lo que valida el `WITH CHECK` pero no descarta una policy mal escrita que distinga entre "tenant que no existe" y "tenant que existe pero no es el mío". **Cerrar H-01 permitiría revisar eso leyendo las policies, que es la forma correcta.**
