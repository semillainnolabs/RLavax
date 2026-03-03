// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockOracle {
    uint256 public price = 1e18; // Default 1:1

    function setPrice(uint256 _price) external {
        price = _price;
    }
}
