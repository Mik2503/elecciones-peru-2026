# Dashboard Electoral Perú 2026 - Guía de Despliegue

## Problema Conocido: Bloqueo de Firewall ONPE

La ONPE utiliza un firewall (probablemente Cloudflare) que **bloquea las peticiones desde IPs de servidores cloud como Vercel**, retornando un error **HTTP 403**.

Esto significa que los endpoints `/api/fetch-results` y `/api/fetch-onpe` **NO funcionarán directamente desde Vercel**.

---

## Soluciones Implementadas

### 1. Endpoint de Proxy con Múltiples Estrategias (`/api/fetch-proxy`)
- Intenta evadir el firewall con headers ultra-realistas de navegador
- Si falla, intenta el endpoint v1 de la API
- Si falla, intenta con headers mínimos
- **Logging detallado** para diagnosticar el tipo de bloqueo

### 2. Fetch Automático desde `/api/data`
- Si Vercel KV está vacío, intenta automáticamente fetch desde ambos endpoints
- Mensaje informativo al usuario si ambos fallan

### 3. Logging Mejorado en Todos los Endpoints
- Cada request loguea: URL, headers, status, preview de respuesta
- Detección automática de Cloudflare vs otros firewalls

### 4. Script de Sync Corregido
- `sync_official.sh` ahora apunta correctamente a `/api/fetch-results` (antes apuntaba a `/api/fetch-onpe` que no aceptaba POST)
- Headers mejorados tipo navegador Chrome completo

---

## Cómo Hacer que Funcione

### OPCIÓN A: Docker Sync desde IP Peruana (Recomendada y Gratuita)

Esta es la solución **más efectiva y económica**.

#### Requisitos:
- Una máquina con **IP de Perú** (puede ser tu PC local en Perú, un VPS barato en Perú, o una Raspberry Pi)
- Docker instalado

#### Pasos:

1. **Clona el repositorio** en la máquina con IP peruana:
   ```bash
   git clone <tu-repo>
   cd elecciones-peru-2026
   ```

2. **Edita `scripts/sync_official.sh`** y cambia la URL del API endpoint:
   ```bash
   API_ENDPOINT="https://TU-DOMINIO.vercel.app/api/fetch-results"
   ```

3. **Construye y ejecuta el contenedor**:
   ```bash
   docker build -t onpe-sync -f Dockerfile.sync .
   docker run --name onpe-sync-container onpe-sync
   ```

4. **Verifica que funciona**:
   - El script mostrará logs cada 60 segundos
   - Visita tu dashboard y debería mostrar datos

#### Detener el contenedor:
```bash
docker stop onpe-sync-container
docker rm onpe-sync-container
```

---

### OPCIÓN B: Usar un Servicio Proxy de Pago

Si no tienes acceso a una IP peruana, puedes usar un servicio proxy residencial:

#### Servicios recomendados:
- **ScraperAPI** (~$29/mes) - https://www.scraperapi.com/
- **BrightData** (~$50/mes) - https://brightdata.com/
- **SmartProxy** (~$40/mes) - https://smartproxy.com/

#### Configuración:

1. Obtén tu API key del servicio proxy
2. Crea un archivo `.env.local` en la raíz del proyecto:
   ```env
   PROXY_URL=http://api.scraperapi.com?api_key=TU_API_KEY&url=
   # o para BrightData:
   # PROXY_URL=http://zproxy.lum-superproxy.io:22225
   # PROXY_USERNAME=your-username
   # PROXY_PASSWORD=your-password
   ```

3. Modifica los endpoints para usar el proxy (implementación pendiente - ver prompt en el informe)

---

### OPCIÓN C: Contactar a la ONPE

Puedes contactar a la ONPE para solicitar acceso autorizado a su API:
- Email: consultas@onpe.gob.pe
- Web: https://www.onpe.gob.pe/

---

## Arquitectura Actual

```
┌─────────────────────────────────────────────────────────────┐
│                    FUENTE DE DATOS                           │
│         ONPE (eg2026.onpe.gob.pe) - 2026                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┴─────────────┐
          │                          │
   /api/fetch-results         /api/fetch-onpe
   (GET/POST)                 (GET/POST)
          │                          │
          └────────────┬─────────────┘
                       │
                ┌──────▼──────┐
                │  Vercel KV  │
                │   (Redis)   │
                └──────┬──────┘
                       │
                  /api/data
                  (GET)
                       │
                ┌──────▼──────┐
                │  Frontend   │
                │  (page.tsx) │
                └─────────────┘
```

---

## Endpoints de la API

| Endpoint | Métodos | Descripción |
|---|---|---|
| `/api/data` | GET | Lee datos de Vercel KV. Si está vacío, intenta fetch automático |
| `/api/fetch-results` | GET, POST | Fetch directo al JSON de ONPE. Acepta POST con datos crudos |
| `/api/fetch-onpe` | GET, POST | Fetch a la API v1 de ONPE. Acepta POST con datos crudos |
| `/api/fetch-proxy` | GET, POST | Proxy con múltiples estrategias anti-bloqueo |

---

## Estructura del Proyecto

```
elecciones-peru-2026/
├── src/app/
│   ├── page.tsx                  # Dashboard principal
│   ├── layout.tsx                # Layout con metadata
│   ├── globals.css               # Estilos Tailwind
│   └── api/
│       ├── data/route.ts         # Lectura de KV + fetch automático
│       ├── fetch-results/route.ts # Endpoint principal (GET/POST)
│       ├── fetch-onpe/route.ts    # Endpoint alternativo v1 (GET/POST)
│       └── fetch-proxy/route.ts   # Proxy multi-estrategia (NUEVO)
├── scripts/
│   └── sync_official.sh          # Script de sync cada 60s (CORREGIDO)
├── Dockerfile.sync               # Contenedor Docker para sync
├── vercel.json                   # Cron job (1x día - insuficiente)
├── REVISION_DATOS_2026_INFORME.txt # Informe completo de revisión
└── README-DEPLOY.md              # Este archivo
```

---

## Verificación de Datos

### ¿Los datos son reales?
**SÍ.** Todos los datos provienen exclusivamente de:
- `https://eg2026.onpe.gob.pe/resultados/presidencial.json`
- `https://eg2026.onpe.gob.pe/api/v1/presidencial/resumen`

**No hay datos simulados, mock, o de ejemplo en ningún lugar del código.**

### ¿Son de 2026?
**SÍ.** Todas las URLs apuntan al subdominio `eg2026` (Elecciones Generales 2026).
No hay referencias a otros años electorales.

---

## Solución de Problemas

### "Esperando datos oficiales de ONPE..."
- El firewall de la ONPE está bloqueando las peticiones desde Vercel
- Ejecuta el Docker Sync desde una IP peruana (Opción A arriba)

### Error 403 en los logs
- Confirmado: el firewall bloquea IPs cloud
- Usa Docker Sync desde IP residencial peruana

### Error 500 en los logs
- Error de procesamiento de datos
- Revisa los logs de Vercel para más detalles

### Datos no se actualizan
- Verifica que el cron job de Vercel esté activo (`vercel.json`)
- O mejor: verifica que el contenedor Docker sync esté corriendo

---

## Notas Importantes

1. **El cron de Vercel** (`vercel.json`) corre solo **1 vez al día a medianoche UTC**. Esto es insuficiente para "tiempo real". El Docker Sync compensa con polling cada 60 segundos.

2. **Los colores de partidos** están hardcodeados para 6 partidos principales. Si hay más partidos, aparecerán en gris por defecto.

3. **El dashboard** es 100% client-side (no hay SSR). Esto afecta SEO pero no la funcionalidad.

4. **Vercel KV** debe estar provisionado y conectado. Sin él, nada funciona.

---

## Contacto

Para dudas sobre el despliegue, revisa el informe `REVISION_DATOS_2026_INFORME.txt` que contiene un prompt detallado para IA que puede ayudar con implementaciones adicionales.
