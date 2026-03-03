// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockVault is ERC20, Ownable {
    IERC20 public assetToken;

    constructor(string memory name, string memory symbol, address _asset) ERC20(name, symbol) Ownable(msg.sender) {
        assetToken = IERC20(_asset);
    }

    function asset() external view returns (address) {
        return address(assetToken);
    }

    function totalAssets() public view returns (uint256) {
        return assetToken.balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public pure returns (uint256) {
        return assets;
    }

    function convertToAssets(uint256 shares) public pure returns (uint256) {
        return shares;
    }

    function previewRedeem(uint256 shares) public pure returns (uint256) {
        return shares;
    }

    function deposit(uint256 assets, address receiver) external returns (uint256) {
        require(assets > 0, "Zero assets");
        assetToken.transferFrom(msg.sender, address(this), assets);
        _mint(receiver, assets);
        return assets;
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256) {
        require(shares > 0, "Zero shares");
        if (msg.sender != owner) {
             uint256 allowed = allowance(owner, msg.sender);
             require(allowed >= shares, "Allowance exceeded");
             _approve(owner, msg.sender, allowed - shares);
        }
        _burn(owner, shares);
        assetToken.transfer(receiver, shares);
        return shares;
    }
}
