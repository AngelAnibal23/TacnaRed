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

## Funciones de la aplicación

- **Resumen** con las cifras del caso y un panel de **alertas de gestión**: actividades vencidas sin terminar, terminadas tarde, brecha de avance, proyección que supera el plazo, probabilidad PERT baja, faltantes de materiales y productos en o bajo el punto de pedido.
- **Importación por CSV** de actividades y productos, con plantilla descargable, vista previa, validación fila por fila y modos «agregar o actualizar» y «reemplazar».
- **Exportación** a CSV por tabla, a JSON del estado visible y a un **libro Excel de siete hojas** (`/api/export/xlsx`): Programación CPM, PERT, Seguimiento, EOQ, ABC, Inventario y Movimientos.

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
DATA_DIR=<ruta escribible del disco persistente distinta de data/>
```

El servidor rechaza la clave de ejemplo en producción. Publicar con HTTPS: la cookie de sesión utiliza Secure en producción. Mantener una sola instancia del servidor. Las sesiones están en memoria y se reinician al reiniciar el servicio.

La base SQLite se crea automáticamente al primer inicio a partir de `data/caso.json`. El disco persistente evita perder los cambios tras reinicios o despliegues. Para copiar la base, detener antes el servidor o usar una copia de seguridad de SQLite.

`DATA_DIR` no debe apuntar a `data/` ni a una ruta que lo cubra: allí vive la semilla `data/caso.json` que la aplicación necesita para crear la base. Un volumen montado encima la oculta y el primer arranque falla.

## Docker

El Dockerfile instala, compila y ejecuta el proyecto. Configurar una clave de producción y montar el volumen persistente en `/app/db` (nunca en `/app/data`); el proveedor debe poner HTTPS delante.

```bash
printf 'OPERADOR_PASSWORD=<clave de 12 caracteres o más>\n' > .env
docker build -t tacnared .
docker run -d --name tacnared --restart unless-stopped \
  --env-file .env -v tacnared-db:/app/db -p 127.0.0.1:4173:4173 tacnared
```

También está disponible `docker-compose.yml` con la misma configuración (`docker compose up -d --build`). El contenedor expone `/api/health` para la comprobación de estado y publica el puerto solo en la interfaz local: el servidor web con HTTPS debe hacer de intermediario. La imagen incluye un `HEALTHCHECK` que consulta ese punto.

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
server/    API Fastify, sesión, persistencia SQLite y libro Excel
domain/    Tipos, validación, algoritmos, alertas y lectura de CSV
data/      Caso inicial (semilla) y esquema de referencia
tests/     Pruebas de cálculo, API y navegador
evidencias/ Capturas y libro Excel exportado de la demostración alojada
```

El repositorio contiene el proyecto necesario para compilar y alojar la web. Los informes académicos, diapositivas y capturas no forman parte de esta publicación. `dist/`, `node_modules/`, `.env` y la base SQLite se generan o configuran en cada entorno.
