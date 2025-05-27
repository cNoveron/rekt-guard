CONTRACT_ADDRESS="$1"
RPC_URL=https://rpc.flashbots.net
RUNTIME_CODE=$(cast code $CONTRACT_ADDRESS --rpc-url $RPC_URL)
# INPUT_DATA="$(cast tx $TX_HASH input --rpc-url $RPC_URL)"

# Extract the first 8 characters after '0x' if present
if [[ "$CONTRACT_ADDRESS" == 0x* ]]; then
    DIR_PREFIX="${CONTRACT_ADDRESS:2:8}"
else
    DIR_PREFIX="${CONTRACT_ADDRESS:0:8}"
fi

# Create output directory
OUTPUT_DIR="PoC/decompiled/${DIR_PREFIX}"
mkdir -p "$OUTPUT_DIR"

heimdall decompile --output "$OUTPUT_DIR" -vvvvv "$RUNTIME_CODE"
echo "Decompiled code saved to $OUTPUT_DIR"