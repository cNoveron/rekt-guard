// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface PendleMarketFactoryV3 {
    function createNewMarket(
        address PT,
        int256 scalarRoot,
        int256 initialAnchor,
        uint80 lnFeeRateRoot
    ) external returns (address market);
}