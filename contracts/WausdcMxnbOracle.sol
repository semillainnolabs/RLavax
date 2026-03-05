// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title WmusdcMxnbOracle
 * @notice Simple oracle that returns a fixed price for Morpho Blue integration
 * @dev
 * - Returns a constant price scaled by 1e36 (Morpho's required precision)
 *
 * Production oracle would use:
 * - Chainlink price feeds
 * - Uniswap TWAP
 * - Other decentralized price oracles
 */
contract WausdcMxnbOracle {
    /// @notice The fixed price returned by this oracle
    /// @dev Morpho requires price scaled by 1e36
    /// For our PoC: 1 WaUSDC (18 decimals) = 17.6 MXNB (6 decimals)
    /// So price = 17.6 * 10^36 = 176 * 1e35
    uint256 private constant PRICE = 176 * 10**(6 - 6 + 35);

    /**
     * Formula for multi-decimal tokens:
     * price = price_in_usd * 10^(loan_decimals - collateral_decimals + 36)
     *
     * For decimals:
     * price = 17.6 * 10^(6 - 6 + 36) = 176 * 1e35
     */
    function price() external pure returns (uint256) {
        return PRICE;
    }

    function priceView() external pure returns (uint256) {
        return PRICE;
    }
}