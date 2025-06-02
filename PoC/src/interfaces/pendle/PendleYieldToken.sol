// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface PendleYieldToken {
    function mintPY(
        address receiverPT,
        address receiverYT
    ) external returns (uint256 amountPYOut);
}