#!/bin/bash
# Script to update production puzzles on Railway
# Usage: ./scripts/update-production-puzzles.sh

echo "Updating production puzzles to 40 clues each..."
echo ""
echo "Option 1: If you have Railway CLI linked, run:"
echo "  railway run psql < database/seeds/puzzles-500-easy.sql"
echo ""
echo "Option 2: If you have DATABASE_URL, run:"
echo "  psql \$DATABASE_URL -f database/seeds/puzzles-500-easy.sql"
echo ""
echo "Option 3: Use Railway Dashboard:"
echo "  1. Go to Railway → PostgreSQL → Query tab"
echo "  2. Copy contents of database/seeds/puzzles-500-easy.sql"
echo "  3. Paste and execute"
echo ""

