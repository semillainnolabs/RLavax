// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./MockAToken.sol";

contract MockAavePool is Ownable {
    mapping(address => address) public aTokens; // asset -> aToken

    constructor() Ownable(msg.sender) {}

    function setAToken(address asset, address aToken) external onlyOwner {
        aTokens[asset] = aToken;
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external {
        address aToken = aTokens[asset];
        require(aToken != address(0), "Asset not supported");

        // Transfer asset from user to this pool
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        
        // Mint aToken to user
        MockAToken(aToken).mint(onBehalfOf, amount);
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        address aToken = aTokens[asset];
        require(aToken != address(0), "Asset not supported");

        // Burn aToken from user
        MockAToken(aToken).burn(msg.sender, amount);
        
        // Transfer asset back to user
        IERC20(asset).transfer(to, amount);
        return amount;
    }
}
