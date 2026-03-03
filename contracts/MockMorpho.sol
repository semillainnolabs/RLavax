// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

struct MarketParams {
    address loanToken;
    address collateralToken;
    address oracle;
    address irm;
    uint256 lltv;
}

struct Position {
    uint256 supplyShares;
    uint256 borrowShares;
    uint256 collateral;
}

struct Market {
    uint128 totalSupplyAssets;
    uint128 totalSupplyShares;
    uint128 totalBorrowAssets;
    uint128 totalBorrowShares;
    uint128 lastUpdate;
    uint128 fee;
}

contract MockMorpho is Ownable {
    mapping(bytes32 => mapping(address => Position)) public positions;
    mapping(bytes32 => Market) public markets;

    constructor() Ownable(msg.sender) {}

    function getMarketId(MarketParams memory marketParams) public pure returns (bytes32) {
        return keccak256(abi.encode(marketParams.loanToken, marketParams.collateralToken, marketParams.oracle, marketParams.irm, marketParams.lltv));
    }

    function market(bytes32 id) external view returns (uint128, uint128, uint128, uint128, uint128, uint128) {
        Market memory m = markets[id];
        return (m.totalSupplyAssets, m.totalSupplyShares, m.totalBorrowAssets, m.totalBorrowShares, m.lastUpdate, m.fee);
    }

    function position(bytes32 id, address user) external view returns (uint256, uint256, uint256) {
        Position memory p = positions[id][user];
        return (p.supplyShares, p.borrowShares, p.collateral);
    }

    function supplyCollateral(MarketParams memory marketParams, uint256 amount, address onBehalf, bytes memory data) external {
        bytes32 id = getMarketId(marketParams);
        positions[id][onBehalf].collateral += amount;
        IERC20(marketParams.collateralToken).transferFrom(msg.sender, address(this), amount);
    }

    function withdrawCollateral(MarketParams memory marketParams, uint256 amount, address onBehalf, address receiver) external {
        bytes32 id = getMarketId(marketParams);
        require(positions[id][onBehalf].collateral >= amount, "Insufficient collateral");
        positions[id][onBehalf].collateral -= amount;
        IERC20(marketParams.collateralToken).transfer(receiver, amount);
    }

    function borrow(MarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) external returns (uint256, uint256) {
        bytes32 id = getMarketId(marketParams);
        
        uint256 borrowAmount = assets;
        if (assets == 0) borrowAmount = shares; // Simplified 1:1
        uint256 borrowShares = borrowAmount;

        positions[id][onBehalf].borrowShares += borrowShares;
        markets[id].totalBorrowAssets += uint128(borrowAmount);
        markets[id].totalBorrowShares += uint128(borrowShares);

        IERC20(marketParams.loanToken).transfer(receiver, borrowAmount);
        return (borrowAmount, borrowShares);
    }

    function repay(MarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, bytes memory data) external returns (uint256, uint256) {
        bytes32 id = getMarketId(marketParams);

        uint256 repayAmount = assets;
        if (assets == 0) repayAmount = shares; // Simplified 1:1
        uint256 repayShares = repayAmount;

        require(positions[id][onBehalf].borrowShares >= repayShares, "Repay exceeds debt");

        positions[id][onBehalf].borrowShares -= repayShares;
        markets[id].totalBorrowAssets -= uint128(repayAmount);
        markets[id].totalBorrowShares -= uint128(repayShares);

        IERC20(marketParams.loanToken).transferFrom(msg.sender, address(this), repayAmount);
        return (repayAmount, repayShares);
    }

    function supply(MarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, bytes memory data) external returns (uint256, uint256) {
        bytes32 id = getMarketId(marketParams);
        uint256 supplyAmount = assets;
        if (assets == 0) supplyAmount = shares;
        uint256 supplyShares = supplyAmount;

        positions[id][onBehalf].supplyShares += supplyShares;
        markets[id].totalSupplyAssets += uint128(supplyAmount);
        markets[id].totalSupplyShares += uint128(supplyShares);

        IERC20(marketParams.loanToken).transferFrom(msg.sender, address(this), supplyAmount);
        return (supplyAmount, supplyShares);
    }

    function withdraw(MarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) external returns (uint256, uint256) {
        bytes32 id = getMarketId(marketParams);
        uint256 withdrawAmount = assets;
        if (assets == 0) withdrawAmount = shares;
        uint256 withdrawShares = withdrawAmount;

        require(positions[id][onBehalf].supplyShares >= withdrawShares, "Insufficient balance");

        positions[id][onBehalf].supplyShares -= withdrawShares;
        markets[id].totalSupplyAssets -= uint128(withdrawAmount);
        markets[id].totalSupplyShares -= uint128(withdrawShares);

        IERC20(marketParams.loanToken).transfer(receiver, withdrawAmount);
        return (withdrawAmount, withdrawShares);
    }
}
