sh PoC/getBytecode.sh 0x2287aa2d87b256b3d6dc79b84463911fd1c6b38b29957235d293b562e62872c4
sh PoC/decompile.sh 0x4af4c234b8cb6e060797e87afb724cfb1d320bb7
sh PoC/deployWithSend.sh 0x2287aa2d87b256b3d6dc79b84463911fd1c6b38b29957235d293b562e62872c4
forge script script/CheckAbiCompatibility.s.sol --fork-url http://localhost:8545 --optimizer-runs 100 --evm-version shanghai -vvvvv