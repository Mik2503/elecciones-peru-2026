#!/bin/sh
# Real-time Official Data Synchronizer
# Fetches directly from ONPE and pushes to Vercel KV via API
# Peru 2026 Elections - Sync every 60 seconds

ONPE_URL="https://eg2026.onpe.gob.pe/resultados/presidencial.json"
# IMPORTANT: Must point to /api/fetch-results which accepts POST (not /api/fetch-onpe)
API_ENDPOINT="https://elecciones-peru-2026-peach.vercel.app/api/fetch-results"

echo "Iniciando Sincronizador OFICIAL Perú 2026..."

while true; do
    echo "[$(date)] Descargando datos oficiales de ONPE..."

    # Fetch official JSON with browser-like headers
    RAW_JSON=$(curl -s \
        -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
        -H "Accept: application/json, text/plain, */*" \
        -H "Accept-Language: es-PE,es;q=0.9,es-419;q=0.8,en;q=0.7" \
        -H "Referer: https://eg2026.onpe.gob.pe/" \
        -H "Origin: https://eg2026.onpe.gob.pe" \
        "$ONPE_URL")

    if [ -z "$RAW_JSON" ] || [ "$RAW_JSON" = "" ]; then
        echo "[ERROR] No se pudo obtener respuesta de ONPE. Reintentando en 60s..."
    else
        # Basic validation: check if it's the official ONPE structure
        if echo "$RAW_JSON" | grep -q "generals" && echo "$RAW_JSON" | grep -q "results"; then
            echo "[SUCCESS] Datos obtenidos. Empujando a Vercel..."

            # POST the raw JSON to /api/fetch-results which processes and stores in KV
            RESPONSE=$(curl -s -X POST \
                -H "Content-Type: application/json" \
                -d "$RAW_JSON" \
                "$API_ENDPOINT")
            echo "[API RESPONSE] $RESPONSE"
        else
            echo "[ERROR] Datos recibidos no tienen formato ONPE oficial."
            echo "[DEBUG] Respuesta recibida (primeros 500 chars): $(echo "$RAW_JSON" | head -c 500)"
        fi
    fi

    sleep 60
done
