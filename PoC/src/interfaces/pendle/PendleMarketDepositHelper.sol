// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface PendleMarketDepositHelper {
    function depositMarket(address _market, uint256 _amount) external;
    function withdrawMarket(address _market, uint256 _amount) external;
}