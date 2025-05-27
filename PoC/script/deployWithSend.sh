# Send the raw creation bytecode to deploy the contract
TX_HASH="$1"
CREATION_BYTECODE="$(cat PoC/bytecode/${TX_HASH:2:8}.hex)"

cast send --rpc-url http://localhost:8545 --private-key "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" -vvvvv --create $CREATION_BYTECODE