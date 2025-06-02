// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../contracts/pendle/contracts/core/erc20/PendleERC20.sol";

contract DeployPendleERC20 is Script {
    function run() external {
        // These parameters should be replaced with the decoded ones from your transaction
        string memory name = "EVIL PENDLE ERC20";
        string memory symbol = "EVIL";
        uint8 decimals = 18;  // Replace with actual decimals

        console.log("Deploying PendleERC20 with parameters:");
        console.log("Name:", name);
        console.log("Symbol:", symbol);
        console.log("Decimals:", decimals);

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        PendleERC20 token = new PendleERC20(name, symbol, decimals);

        console.log("Deployed PendleERC20 at:", address(token));
        vm.stopBroadcast();
    }
}