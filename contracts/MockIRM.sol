// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

struct MarketParams {
    address loanToken;
    address collateralToken;
    address oracle;
    address irm;
    uint256 lltv;
}

struct Market {
    uint128 totalSupplyAssets;
    uint128 totalSupplyShares;
    uint128 totalBorrowAssets;
    uint128 totalBorrowShares;
    uint128 lastUpdate;
    uint128 fee;
}

contract MockIRM {
    function borrowRateView(MarketParams memory, Market memory) external pure returns (uint256) {
        return 1585489599; // approx 5% APY
    }
}
