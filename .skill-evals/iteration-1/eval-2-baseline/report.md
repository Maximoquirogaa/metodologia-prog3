# Tests del backend — resultado

**Fecha**: 2026-10-29
**Alcance**: solo backend, sin Docker, sin DB.

## TL;DR

No hay tests. `npm test` falla porque no existe el directorio `backend/test/`.
El backend hoy es un esqueleto de 1 archivo (`backend/src/index.js`) con un solo endpoint `/api/health`.

## Qué corrí

| Comando | Resultado |
|---------|-----------|
| `npm test` (en `backend/`) | ❌ exit 1 — `Could not find 'test/'` |
| `node --test` (en `backend/`, descubrimiento por defecto) | ✅ exit 0 — `tests 0, pass 0, fail 0` |
| Smoke in-process de `GET /api/health` (sin DB, puerto efímero, server cerrado al final) | ✅ `200 {"status":"ok"}` |

Entorno: Node v24.20.0, npm 11.19.0, `backend/node_modules` ya instalado (69 paquetes).

## Por qué falla

`backend/package.json`:

```json
"test": "node --test test/"
```

…pero `backend/test/` no existe. Tampoco hay ningún archivo `*.test.js` / `*.spec.js` en el repo del backend:

```
backend/
  app/          (solo .gitkeep en application/, domain/, infrastructure/)
  src/index.js  (48 líneas: createApp() + /api/health)
  Dockerfile
  package.json
```

O sea: no es que los tests estén rotos, es que todavía no se escribió ninguno. Cero cobertura real.

## Detalle técnico menor

- `src/index.js` hace `app.listen()` salvo que `NODE_ENV === 'test'`. Corrí todo con `NODE_ENV=test` para no dejar nada escuchando en el puerto 3000.
- El smoke test abrió el server en un puerto efímero y lo cerró en un `finally`; no quedó ningún proceso vivo.
- No se tocó ningún archivo del repo (git status idéntico al inicial), no se usó Docker, no se tocó la DB.

## Recomendación

1. Crear `backend/test/` con al menos un test de `createApp()` + `/api/health` para que `npm test` deje de fallar (2 minutos de trabajo, sin DB).
2. Cuando lleguen los endpoints de turnos, usar el `node:test` nativo que ya está configurado — no hace falta sumar framework.
3. Si en el futuro hay tests de integración con Postgres, separalos en un script aparte (ej. `test:integration`) para que `npm test` siga siendo rápido y sin Docker.

**Nota**: no hay nada que verificar en verde/amarillo/rojo todavía — el veredicto es "sin suite de tests", no "tests fallando".
