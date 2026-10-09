# TacnaRed

Aplicación de demostración de Investigación Operativa II: PERT/CPM, EOQ, ABC y seguimiento de una instalación de 48 puntos de red. Los datos del caso son simulados.

## Ejecutar localmente

Requiere Node.js **24.15 o superior** y npm.

```bash
npm ci
npm run build
npm start
```

Abrir http://127.0.0.1:4173. La clave de demostración local es `tacnared-demo`.

## Alojar la web

La aplicación necesita un servicio que ejecute Node.js y proporcione almacenamiento persistente para SQLite. Interfaz y API se sirven desde el mismo origen. GitHub Pages y otros servicios de archivos estáticos no ejecutan este servidor.

- Directorio del proyecto: raíz del repositorio.
- Comando de instalación y compilación: `npm ci && npm run build`.
- Comando de inicio: `npm start`.
- Versión de Node.js: 24.15 o superior.
- Comprobación de estado: `/api/health`.

Configurar en el alojamiento:

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=<puerto proporcionado por el servicio>
OPERADOR_PASSWORD=<clave propia de al menos 12 caracteres>
DATA_DIR=<ruta escribible del disco persistente>
```

El servidor rechaza la clave de ejemplo en producción. Publicar con HTTPS: la cookie de sesión utiliza Secure en producción. Mantener una sola instancia del servidor. Las sesiones están en memoria y se reinician al reiniciar el servicio.

La base SQLite se crea automáticamente al primer inicio a partir de `data/caso.json`. El disco persistente evita perder los cambios tras reinicios o despliegues. Para copiar la base, detener antes el servidor o usar una copia de seguridad de SQLite.

## Docker

El Dockerfile instala, compila y ejecuta el proyecto. Configurar una clave de producción y montar un volumen persistente en `/app/data`; el proveedor debe poner HTTPS delante. La receta Docker no fue ejecutada en el equipo de desarrollo.

## Pruebas

```bash
npm test
npm run typecheck
```

Las pruebas de navegador son opcionales para desplegar:

```bash
npx playwright install chromium
npm run test:e2e
npm run test:theme
npm run test:closure
```

## Estructura

```text
src/       Interfaz React y gráficos
server/    API Fastify, sesión y persistencia SQLite
domain/    Tipos, validación y algoritmos
data/      Caso inicial y esquema de referencia
tests/     Pruebas de cálculo, API y navegador
```

El repositorio contiene el proyecto necesario para compilar y alojar la web. Los informes académicos, diapositivas y capturas no forman parte de esta publicación. `dist/`, `node_modules/`, `.env` y la base SQLite se generan o configuran en cada entorno.
