// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface PendleMarketV3 {
    function mint(
        address receiver,
        uint256 netSyDesired,
        uint256 netPtDesired
    ) external returns (uint256 netLpOut, uint256 netSyUsed, uint256 netPtUsed);

    function redeemRewards(address user) external returns (uint256[] memory);
}