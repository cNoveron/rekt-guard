// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";

contract ABIVerification is Script {
    address deployedContract = 0x8786A226918A4c6Cd7B3463ca200f156C964031f;

    function checkSelectors() public {
        // List of function selectors from your ABI
        bytes4[] memory selectors = new bytes4[](9);
        selectors[0] = bytes4(keccak256("assetInfo()"));
        selectors[1] = bytes4(keccak256("balanceOf(address)"));
        selectors[2] = bytes4(keccak256("claimRewards(address)"));
        selectors[3] = bytes4(keccak256("exchangeRate()"));
        selectors[4] = bytes4(keccak256("getRewardTokens()"));
        selectors[5] = bytes4(keccak256("name()"));
        selectors[6] = bytes4(keccak256("rewardIndexesCurrent()"));
        selectors[7] = bytes4(keccak256("sweepETH()"));
        selectors[8] = bytes4(keccak256("symbol()"));

        console.log("Selector length:", selectors.length);

        for (uint i = 0; i < selectors.length; i++) {
            (bool success, ) = deployedContract.staticcall(abi.encodePacked(selectors[i]));

            if (success || this.checkSelectorInBytecode(selectors[i])) {
                console.log("Selector found:", vm.toString(selectors[i]));
            } else {
                console.log("Selector missing:", vm.toString(selectors[i]));
            }
        }
    }

    function checkSelectorInBytecode(bytes4 selector) external view returns (bool) {
        bytes memory code = deployedContract.code;
        bytes memory selectorBytes = abi.encodePacked(selector);

        // Simple check if selector bytes appear in code
        for (uint i = 0; i <= code.length - 4; i++) {
            if (code[i] == selectorBytes[0] &&
                code[i+1] == selectorBytes[1] &&
                code[i+2] == selectorBytes[2] &&
                code[i+3] == selectorBytes[3]) {
                return true;
            }
        }
        return false;
    }

    function run() public {
        checkSelectors();
    }
}