TX_HASH="$1"
RPC_URL=https://rpc.flashbots.net
INPUT_DATA="$(cast tx $TX_HASH input --rpc-url $RPC_URL)"

# Extract the first 8 characters (4 bytes) after '0x' if present
if [[ "$INPUT_DATA" == 0x* ]]; then
    FILE_PREFIX="${INPUT_DATA:2:8}"
else
    FILE_PREFIX="${INPUT_DATA:0:8}"
fi

mkdir -p bytecode
OUTPUT_FILE="bytecode/${FILE_PREFIX}.hex"

echo "$INPUT_DATA" > "$OUTPUT_FILE"
echo "Bytecode saved to $OUTPUT_FILE"
