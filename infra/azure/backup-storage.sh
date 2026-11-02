#!/usr/bin/env bash
# Storage for daily Postgres backups, deleted automatically after RETENTION_DAYS. Safe to re-run.
# The VM uploads with its managed identity (no keys); you get read access to download backups.
set -euo pipefail

LOCATION="${LOCATION:-polandcentral}"
RESOURCE_GROUP="${RESOURCE_GROUP:-murder-mystery-rg}"
VM_NAME="${VM_NAME:-mm-server}"
STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-mmg10backups}"     # globally unique, 3-24 lowercase letters/digits
BACKUP_CONTAINER="${BACKUP_CONTAINER:-postgres-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TAGS="project=murder-mystery"

log() { printf '\n==> %s\n' "$*"; }

if ! az storage account show -g "$RESOURCE_GROUP" -n "$STORAGE_ACCOUNT" &>/dev/null; then
  log "Storage account $STORAGE_ACCOUNT"
  az storage account create -g "$RESOURCE_GROUP" -n "$STORAGE_ACCOUNT" -l "$LOCATION" \
    --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 \
    --allow-blob-public-access false --allow-shared-key-access false \
    --tags $TAGS -o none
fi
ACCOUNT_ID="$(az storage account show -g "$RESOURCE_GROUP" -n "$STORAGE_ACCOUNT" --query id -o tsv)"

log "Container $BACKUP_CONTAINER"
az storage container-rm create -g "$RESOURCE_GROUP" --storage-account "$STORAGE_ACCOUNT" \
  -n "$BACKUP_CONTAINER" -o none

log "Lifecycle: delete backups older than $RETENTION_DAYS days"
az storage account management-policy create -g "$RESOURCE_GROUP" --account-name "$STORAGE_ACCOUNT" -o none \
  --policy "{\"rules\": [{\"enabled\": true, \"name\": \"delete-old-backups\", \"type\": \"Lifecycle\",
    \"definition\": {
      \"filters\": {\"blobTypes\": [\"blockBlob\"], \"prefixMatch\": [\"$BACKUP_CONTAINER/postgres/\"]},
      \"actions\": {\"baseBlob\": {\"delete\": {\"daysAfterModificationGreaterThan\": $RETENTION_DAYS}}}
    }}]}"

assign_role() {  # object id, principal type, role, scope
  if [[ -z "$(az role assignment list --assignee "$1" --role "$3" --scope "$4" --query '[0].id' -o tsv)" ]]; then
    az role assignment create --assignee-object-id "$1" --assignee-principal-type "$2" \
      --role "$3" --scope "$4" -o none
  fi
}

CONTAINER_SCOPE="$ACCOUNT_ID/blobServices/default/containers/$BACKUP_CONTAINER"

log "Roles: VM writes backups, you can read them"
VM_PRINCIPAL="$(az vm show -g "$RESOURCE_GROUP" -n "$VM_NAME" --query identity.principalId -o tsv)"
assign_role "$VM_PRINCIPAL" ServicePrincipal "Storage Blob Data Contributor" "$CONTAINER_SCOPE"
ME="$(az ad signed-in-user show --query id -o tsv)"
assign_role "$ME" User "Storage Blob Data Reader" "$CONTAINER_SCOPE"

log "Done (role assignments can take a few minutes to apply)"
echo "  List backups: az storage blob list --account-name $STORAGE_ACCOUNT -c $BACKUP_CONTAINER --auth-mode login -o table"
