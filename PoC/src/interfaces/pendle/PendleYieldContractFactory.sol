// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface PendleYieldContractFactory {
    function createYieldContract(
        address SY,
        uint32 expiry,
        bool doCacheIndexSameBlock
    ) external returns (address PT, address YT);
}