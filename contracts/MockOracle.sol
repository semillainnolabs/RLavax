// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Mock Oracle returning MXNB per WaUSDC price scaled by 1e18.
 * Example: if 1 WaUSDC == 17 MXNB -> price = 17 * 1e36
 * For simplicity in tests you will set price such that subsidy math is clear.
 */
contract MockOracle {
    /**
     * PRICE: Price of collateral quoted in loan token, scaled by 1e36
     * Formula for multi-decimal tokens:
     * price = price_in_usd * 10^(loan_decimals - collateral_decimals + 36)
     *
     * For equal decimals (both 6):
     * price = 17 * 10^(6 - 6 + 36) = 17 * 1e36
     */
    uint256 private PRICE = 17 * 10**(6 - 6 + 36); // MXNB per WaUSDC
    
    function setPrice(uint256 p) external {
        PRICE = p;
    }

    /**
     * @notice Get the price of collateral quoted in loan token
     * @return price Price scaled by 1e36
     * @dev
     * Formula for multi-decimal tokens:
     * price = price_in_usd * 10^(loan_decimals - collateral_decimals + 36)
     *
     * For equal decimals (both 6):
     * price = 17 * 10^(6 - 6 + 36) = 17 * 1e36
     */
    function price() external view returns (uint256) {
        return PRICE;
    }

    /**
     * @notice View function version (same as price())
     * @return price Price scaled by 1e36
     */
    function priceView() external view returns (uint256) {
        return PRICE;
    }
}