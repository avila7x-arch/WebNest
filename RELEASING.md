# Publicar WebNest

WebNest publica versiones de Windows x64 en GitHub Releases. `electron-updater` comprueba la release estable, descarga la actualización cuando el usuario la acepta y permite instalarla al reiniciar o al cerrar WebNest.

## Configuración única

El repositorio debe ser público para que las instalaciones puedan descargar actualizaciones de GitHub sin almacenar credenciales en la aplicación. La configuración de electron-builder obtiene `owner` y `repo` del campo `repository` de `package.json`.

En **Settings → Secrets and variables → Actions**, configura:

- `WIN_CSC_LINK`: certificado PFX de firma de código de Windows codificado en Base64.
- `WIN_CSC_KEY_PASSWORD`: contraseña del PFX.

Para codificar el PFX localmente en PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('certificate.pfx'))
```

Guarda el resultado directamente como secreto. Nunca añadas el PFX, su contraseña ni su contenido Base64 al repositorio. La firma tiene que proceder de un certificado de firma de código válido; la firma estándar puede seguir mostrando advertencias de SmartScreen mientras gana reputación.

## Publicar una versión

1. Incrementa `version` en `package.json` usando SemVer y actualiza notas de versión si corresponde.
2. Ejecuta `pnpm typecheck` y `pnpm build`.
3. Confirma y sube los cambios a `main`.
4. Crea y sube una etiqueta que coincida con el número de versión, por ejemplo:

```sh
git tag v0.1.2
git push origin v0.1.2
```

GitHub Actions verifica que la etiqueta coincide con `package.json`, instala dependencias con el lockfile congelado, valida los tipos, firma y publica el instalador NSIS y los artefactos `latest.yml`/`.blockmap`.

## Incorporar instalaciones existentes

Los instaladores `0.1.0` ya distribuidos no incluyen `electron-updater` ni una configuración de feed. No pueden actualizarse automáticamente: hay que instalar una vez la primera versión publicada con auto-update (actualmente `0.1.1`). A partir de esa versión, las siguientes releases se ofrecen desde GitHub.

Mantén el mismo certificado/editor de firma entre releases para que la verificación de firma de Windows acepte las actualizaciones. Si se sustituye el certificado, planifica una transición y prueba una actualización desde una instalación anterior antes de publicar ampliamente.
