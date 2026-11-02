#!/usr/bin/env bash
# Creates the shared Murder Mystery server on Azure.
#
# Safe to re-run: existing resources are left as they are.
# To rebuild on another account: `az login`, adjust the variables below
# (or override them from the environment), run the script again.
#
# Usage:
#   DNS_LABEL=murder-mystery-g10 ./infra/azure/create-vm.sh
#
# Tear everything down:
#   az group delete -n "$RESOURCE_GROUP" --yes

set -euo pipefail

LOCATION="${LOCATION:-polandcentral}"
RESOURCE_GROUP="${RESOURCE_GROUP:-murder-mystery-rg}"
VM_NAME="${VM_NAME:-mm-server}"
VM_SIZE="${VM_SIZE:-Standard_B2s_v2}"           # only size allowed + available on Azure for Students (UBB)
IMAGE="${IMAGE:-Canonical:ubuntu-24_04-lts:server:latest}"
OS_DISK_GB="${OS_DISK_GB:-64}"                     # 64 GiB Premium SSD = P6, inside the free tier
ADMIN_USER="${ADMIN_USER:-azureuser}"
SSH_PUBLIC_KEY="${SSH_PUBLIC_KEY:-$HOME/.ssh/id_ed25519.pub}"
DNS_LABEL="${DNS_LABEL:?Set DNS_LABEL, e.g. murder-mystery-g10 (lowercase, unique per region)}"

IP_NAME="${VM_NAME}-ip"
NSG_NAME="${VM_NAME}-nsg"
VM_SCOPE="/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Compute/virtualMachines/$VM_NAME"
TAGS="project=murder-mystery"

log() { printf '\n==> %s\n' "$*"; }

[[ -f "$SSH_PUBLIC_KEY" ]] || {
  echo "SSH public key not found: $SSH_PUBLIC_KEY (create one with ssh-keygen -t ed25519)" >&2
  exit 1
}

log "Subscription: $(az account show --query name -o tsv)"

log "Resource group $RESOURCE_GROUP in $LOCATION"
az group create -n "$RESOURCE_GROUP" -l "$LOCATION" --tags $TAGS -o none

if ! az network public-ip show -g "$RESOURCE_GROUP" -n "$IP_NAME" &>/dev/null; then
  log "Static public IP with DNS label $DNS_LABEL"
  az network public-ip create -g "$RESOURCE_GROUP" -n "$IP_NAME" \
    --sku Standard --allocation-method Static --version IPv4 \
    --dns-name "$DNS_LABEL" --tags $TAGS -o none
fi

if ! az network nsg show -g "$RESOURCE_GROUP" -n "$NSG_NAME" &>/dev/null; then
  log "Network security group: allow 22, 80, 443"
  az network nsg create -g "$RESOURCE_GROUP" -n "$NSG_NAME" --tags $TAGS -o none
  # SSH stays open to the internet: GitHub Actions runners have no fixed IPs.
  # Password login is disabled, so only key holders get in.
  az network nsg rule create -g "$RESOURCE_GROUP" --nsg-name "$NSG_NAME" \
    -n allow-ssh --priority 100 --protocol Tcp --destination-port-ranges 22 \
    --access Allow --direction Inbound -o none
  az network nsg rule create -g "$RESOURCE_GROUP" --nsg-name "$NSG_NAME" \
    -n allow-web --priority 110 --protocol '*' --destination-port-ranges 80 443 \
    --access Allow --direction Inbound -o none   # '*' so HTTP/3 (UDP 443) works with Caddy
fi

if ! az vm show -g "$RESOURCE_GROUP" -n "$VM_NAME" &>/dev/null; then
  log "VM $VM_NAME ($VM_SIZE, $IMAGE)"
  az vm create -g "$RESOURCE_GROUP" -n "$VM_NAME" \
    --image "$IMAGE" --size "$VM_SIZE" \
    --admin-username "$ADMIN_USER" --ssh-key-values "$SSH_PUBLIC_KEY" \
    --authentication-type ssh \
    --assign-identity "[system]" --role "Virtual Machine Contributor" --scope "$VM_SCOPE" \
    --public-ip-address "$IP_NAME" --nsg "$NSG_NAME" \
    --os-disk-size-gb "$OS_DISK_GB" --storage-sku Premium_LRS \
    --os-disk-delete-option Delete --nic-delete-option Delete \
    --tags $TAGS -o none
else
  log "VM $VM_NAME already exists, skipping"
fi


FQDN="$(az network public-ip show -g "$RESOURCE_GROUP" -n "$IP_NAME" --query dnsSettings.fqdn -o tsv)"
IP="$(az network public-ip show -g "$RESOURCE_GROUP" -n "$IP_NAME" --query ipAddress -o tsv)"

log "Done"
echo "  Address: $FQDN ($IP)"
echo "  SSH:     ssh $ADMIN_USER@$FQDN"
