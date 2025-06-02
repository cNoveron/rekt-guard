// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface MasterPenpie {
    function multiclaim(
        address[] calldata _stakingTokens
    ) external;
}
