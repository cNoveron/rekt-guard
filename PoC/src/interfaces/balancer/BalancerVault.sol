// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface BalancerVault {
    function flashLoan(
        address recipient,
        address[] memory tokens,
        uint256[] memory amounts,
        bytes memory userData
    ) external;
}