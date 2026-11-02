#!/usr/bin/env bash
# Lets GitHub Actions start/stop the VM through OIDC (no secrets stored in GitHub).
# Only workflows that use the "production" environment of the repo below can sign in.
# Safe to re-run. Prints the three values to store in the GitHub environment.
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-murder-mystery-rg}"
LOCATION="${LOCATION:-polandcentral}"
VM_NAME="${VM_NAME:-mm-server}"
IDENTITY_NAME="${IDENTITY_NAME:-mm-github-actions}"
GITHUB_REPO="${GITHUB_REPO:-murder-mystery-g10/murder-mystery}"
GITHUB_ENVIRONMENT="${GITHUB_ENVIRONMENT:-production}"
TAGS="project=murder-mystery"

log() { printf '\n==> %s\n' "$*"; }

az provider register -n Microsoft.ManagedIdentity --wait

log "Managed identity $IDENTITY_NAME"
az identity create -g "$RESOURCE_GROUP" -n "$IDENTITY_NAME" -l "$LOCATION" --tags $TAGS -o none

log "Trust GitHub Actions: repo $GITHUB_REPO, environment $GITHUB_ENVIRONMENT"
az identity federated-credential create -g "$RESOURCE_GROUP" --identity-name "$IDENTITY_NAME" \
  -n github-production \
  --issuer https://token.actions.githubusercontent.com \
  --subject "repo:${GITHUB_REPO}:environment:${GITHUB_ENVIRONMENT}" \
  --audiences api://AzureADTokenExchange -o none

# Newer GitHub repos put immutable IDs in the subject (owner@id/repo@id); trust that format too.
OWNER_ID="$(gh api "repos/$GITHUB_REPO" --jq .owner.id)"
REPO_ID="$(gh api "repos/$GITHUB_REPO" --jq .id)"
az identity federated-credential create -g "$RESOURCE_GROUP" --identity-name "$IDENTITY_NAME" \
  -n github-production-ids \
  --issuer https://token.actions.githubusercontent.com \
  --subject "repo:${GITHUB_REPO%%/*}@${OWNER_ID}/${GITHUB_REPO#*/}@${REPO_ID}:environment:${GITHUB_ENVIRONMENT}" \
  --audiences api://AzureADTokenExchange -o none

log "Role: Virtual Machine Contributor on $VM_NAME only"
PRINCIPAL_ID="$(az identity show -g "$RESOURCE_GROUP" -n "$IDENTITY_NAME" --query principalId -o tsv)"
VM_ID="$(az vm show -g "$RESOURCE_GROUP" -n "$VM_NAME" --query id -o tsv)"
if [[ -z "$(az role assignment list --assignee "$PRINCIPAL_ID" --role "Virtual Machine Contributor" --scope "$VM_ID" --query '[0].id' -o tsv)" ]]; then
  az role assignment create --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
    --role "Virtual Machine Contributor" --scope "$VM_ID" -o none
fi

log "Done. Values for the GitHub environment '$GITHUB_ENVIRONMENT' (variables, not secrets):"
echo "AZURE_CLIENT_ID=$(az identity show -g "$RESOURCE_GROUP" -n "$IDENTITY_NAME" --query clientId -o tsv)"
echo "AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)"
echo "AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)"
