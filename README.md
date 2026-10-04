# WebNest
WebNest administra sitios como aplicaciones de escritorio con perfiles aislados de Chromium. Cada perfil conserva sus propias cookies y almacenamiento.

## Desarrollo

Requiere Node.js y pnpm.

```sh
pnpm install
pnpm dev
```

Verificaciones y paquete de Windows:

```sh
pnpm typecheck
pnpm build
pnpm dist:win
```

El instalador NSIS se genera en `release/`.

## Actualizaciones

Las versiones publicadas en GitHub Releases se distribuyen mediante el actualizador de WebNest. El flujo de publicación por etiquetas y los secretos requeridos se documentan en [`RELEASING.md`](RELEASING.md).

La biblioteca y los datos de perfil permanecen en el equipo del usuario; no forman parte del instalador ni de las actualizaciones.
