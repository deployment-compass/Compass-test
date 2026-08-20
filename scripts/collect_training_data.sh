#!/usr/bin/env bash
# Collects metrics from the Compass API over time for training anomaly models.

set -euo pipefail

DURATION_SECONDS=300
INTERVAL_SECONDS=10
OUTPUT_FILE="training_data.jsonl"
API_URL="http://compass:8000/training/collect"

usage() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  --duration <seconds>   Total time to collect data (default: 300)"
    echo "  --interval <seconds>   Wait time between polls (default: 10)"
    echo "  --output <file>        Output file for JSONL data (default: training_data.jsonl)"
    echo "  --url <url>            Compass API /collect endpoint (default: http://localhost:8000/training/collect)"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --duration)
            DURATION_SECONDS="$2"
            shift 2
            ;;
        --interval)
            INTERVAL_SECONDS="$2"
            shift 2
            ;;
        --output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --url)
            API_URL="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

echo "Starting training data collection..."
echo "  Duration: ${DURATION_SECONDS}s"
echo "  Interval: ${INTERVAL_SECONDS}s"
echo "  Output:   ${OUTPUT_FILE}"
echo "  Target:   ${API_URL}"

# Ensure output file exists without clearing existing contents
touch "${OUTPUT_FILE}"

END_TIME=$((SECONDS + DURATION_SECONDS))

while [ $SECONDS -lt $END_TIME ]; do
    echo "Collecting sample at $(date)..."
    
    # We use -s for silent, -f to fail on HTTP errors if desired (but omitting to see partial errors if any)
    RESPONSE=$(curl -X 'POST'  "${API_URL}")
    
    # Append the raw JSON array or object as a single line JSONL
    if [ -n "$RESPONSE" ]; then
        echo "$RESPONSE" | tr -d '\n' >> "${OUTPUT_FILE}"
        echo "" >> "${OUTPUT_FILE}"
    else
        echo "Warning: Empty response from API"
    fi
    
    # Sleep until next interval unless we're out of time
    
    sleep $INTERVAL_SECONDS
    
done

echo "Collection complete! Data written to ${OUTPUT_FILE}."
