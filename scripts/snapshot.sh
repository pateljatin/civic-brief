#!/usr/bin/env bash
# Creates a timestamped 7z backup of the ENTIRE civic-brief project
# Includes .env files, .git, .claude, .next - everything except node_modules
# Saves to both local (keep 5) and OneDrive (keep 20, auto-syncs to cloud)
#
# Usage: bash scripts/snapshot.sh [label]
# Example: bash scripts/snapshot.sh pre-filter-repo

set -euo pipefail

LOCAL_BACKUP_DIR="/c/Users/jatin/code/backups"
CLOUD_BACKUP_DIR="/c/Users/jatin/OneDrive/Backups/civic-brief"
PROJECT_DIR="/c/Users/jatin/code/civic-brief"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
LABEL="${1:-snapshot}"
FILENAME="civic-brief-${TIMESTAMP}-${LABEL}.7z"

LOCAL_KEEP=5
CLOUD_KEEP=20

mkdir -p "$CLOUD_BACKUP_DIR"
mkdir -p "$LOCAL_BACKUP_DIR"

cd "$PROJECT_DIR"

# Full snapshot - only exclude node_modules (reinstallable via npm ci)
7z a "$CLOUD_BACKUP_DIR/$FILENAME" . \
  -xr!node_modules \
  -bso0 -bsp0

# Copy to local backup
cp "$CLOUD_BACKUP_DIR/$FILENAME" "$LOCAL_BACKUP_DIR/$FILENAME"

SIZE=$(du -h "$CLOUD_BACKUP_DIR/$FILENAME" | cut -f1)
echo "Snapshot saved ($SIZE):"
echo "  Cloud:  $CLOUD_BACKUP_DIR/$FILENAME"
echo "  Local:  $LOCAL_BACKUP_DIR/$FILENAME"

# Rotate local: keep newest 5
LOCAL_COUNT=$(ls -1t "$LOCAL_BACKUP_DIR"/civic-brief-*.7z 2>/dev/null | wc -l)
if [ "$LOCAL_COUNT" -gt "$LOCAL_KEEP" ]; then
  ls -1t "$LOCAL_BACKUP_DIR"/civic-brief-*.7z | tail -n +"$((LOCAL_KEEP + 1))" | while read -r old; do
    rm "$old"
    echo "  Pruned local: $(basename "$old")"
  done
fi

# Rotate cloud: keep newest 20
CLOUD_COUNT=$(ls -1t "$CLOUD_BACKUP_DIR"/civic-brief-*.7z 2>/dev/null | wc -l)
if [ "$CLOUD_COUNT" -gt "$CLOUD_KEEP" ]; then
  ls -1t "$CLOUD_BACKUP_DIR"/civic-brief-*.7z | tail -n +"$((CLOUD_KEEP + 1))" | while read -r old; do
    rm "$old"
    echo "  Pruned cloud: $(basename "$old")"
  done
fi

echo "Backups: $LOCAL_COUNT local (keep $LOCAL_KEEP), $CLOUD_COUNT cloud (keep $CLOUD_KEEP)"
echo "To restore: 7z x <path>/$FILENAME -o/path/to/restore"
