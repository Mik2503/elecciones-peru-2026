#!/bin/sh
# Real-time Official Data Synchronizer
# Fetches directly from ONPE and pushes to Vercel KV via API

ONPE_URL="https://eg2026.onpe.gob.pe/resultados/presidencial.json"
API_ENDPOINT="https://elecciones-peru-2026-peach.vercel.app/api/fetch-onpe"

echo "Iniciando Sincronizador OFICIAL Perú 2026..."

parse_onpe_number() {
    echo "$1" | tr -d ','
}

while true; do
    echo "[$(date)] Descargando datos oficiales de ONPE..."
    
    # Fetch official JSON
    RAW_JSON=$(curl -s -H "User-Agent: Mozilla/5.0" "$ONPE_URL")
    
    if [ -z "$RAW_JSON" ]; then
        echo "[ERROR] No se pudo obtener respuesta de ONPE. Reintentando en 60s..."
    else
        # Basic validation: check if it's JSON
        if echo "$RAW_JSON" | grep -q "generals"; then
            # We send the RAW JSON to our API for processing
            # This ensures the processing logic lives in one place (Next.js)
            # Actually, the route.ts I wrote handles the processing.
            # But the route.ts GET handles fetch. 
            # I'll update route.ts to handle the processing in POST too.
            
            echo "[SUCCESS] Datos obtenidos. Empujando a Vercel..."
            
            # Simple trick: Post the raw data to the API as a 'raw' field
            # Or just update route.ts to accept the raw format.
            
            RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "$RAW_JSON" "$API_ENDPOINT")
            echo "[API RESPONSE] $RESPONSE"
        else
            echo "[ERROR] Datos recibidos no tienen formato ONPE oficial."
        fi
    fi
    
    sleep 60
done
