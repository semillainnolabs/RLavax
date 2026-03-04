// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockAToken is ERC20, Ownable {
    address public pool;
    address public underlyingAsset;
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        address _pool,
        address _underlyingAsset, 
        uint8 decimals_
    ) ERC20(name, symbol) Ownable(_pool) {
        pool = _pool;
        underlyingAsset = _underlyingAsset;
        _decimals = decimals_;
    }

    function mint(address user, uint256 amount) external onlyOwner {
        _mint(user, amount);
    }

    function burn(address user, uint256 amount) external onlyOwner {
        _burn(user, amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
