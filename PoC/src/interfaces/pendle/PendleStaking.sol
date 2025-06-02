// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface PendleStaking {
    struct Pool {
        address market;
        address rewarder;
        address helper;
        address receiptToken;
        uint256 lastHarvestTime;
        bool isActive;
    }

    function pools(address) external view returns(Pool memory);

    function batchHarvestMarketRewards(
        address[] calldata _markets,
        uint256 minEthToRecieve
    ) external;

    function harvestMarketReward(
        address _market,
        address _caller,
        uint256 _minEthRecive
    ) external;
}