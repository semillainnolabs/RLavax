// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

interface IDebtLens {
    function getAccruedInterest(bytes32 marketId, address user) external view returns (uint256);
}
interface IWaUSDCMXNBOracle {
    // NOTE: oracle price is MXNB per WaUSDC scaled by 1e36
    function price() external view returns (uint256);
}

/**
 * WaUSDC - ERC4626 wrapper around aUSDC with subsidy reservation mechanics
 *
 * - OZ v5 constructor pattern used (ERC20, ERC4626, Ownable)
 * - getInterestSubsidy: idempotent/resizing reservation using 1e36 oracle scaling
 * - redeemWithInterestSubsidy: burns shares, reduces principal pro rata, returns principal + subsidy
 *   (vault keeps any remaining yield)
 * - Uses virtual assets/shares to prevent share inflation attacks and ensure
 *   deposits convert 1:1 with assets on initial deposit
 */
contract WaUSDC is ERC4626, Ownable {
    using Math for uint256;
    IERC20 public immutable aToken;
    uint8 private constant _decimals = 6;
    
    // Virtual assets/shares to prevent inflation and ensure initial deposit parity
    uint256 private constant VIRTUAL_ASSETS = 1;
    uint256 private constant VIRTUAL_SHARES = 1;

    uint256 public totalPrincipal;
    mapping(address => uint256) public userPrincipal;

    mapping(address => uint256) public userInterestSubsidyInWaUSDC; // subsidy reserved (aToken units, 6 decimals)
    mapping(address => uint256) public userInterestInMXNB; // bookkeeping (6 decimals)
    mapping(address => uint256) public userPaidSubsidyInUSDC; // subsidy actually paid out (aUSDC units, 6 decimals)
    uint256 public totalAllocatedSubsidy;

    address public debtLens;
    address public mxnbUsdcOracle;
    bytes32 public marketId;

    event SubsidyRequested(
        address indexed user,
        uint256 interestInMXNB,
        uint256 subsidyInWaUSDC,
        uint256 desiredInAUSDC,
        uint256 newReserved,
        uint256 delta
    );
    event SubsidyRevoked(address indexed user, uint256 amount);
    event SubsidyUsed(
        address indexed user,
        uint256 principalReduced,
        uint256 subsidyPaid,
        uint256 totalOutput,
        uint256 availableYield
    );
    event PrincipalReduced(address indexed user, uint256 amount);
    event YieldWithdrawn(address indexed recipient, uint256 amount, uint256 timestamp);
    event DebtLensUpdated(address indexed oldDebtLens, address indexed newDebtLens);
    event MXNBUsdcOracleUpdated(address indexed oldOracle, address indexed newOracle);
    event MarketIdUpdated(bytes32 indexed oldMarketId, bytes32 indexed newMarketId);

    constructor(IERC20 _aToken)
        ERC20("Wrapped Aave USDC", "WaUSDC")
        ERC4626(_aToken)
        Ownable(msg.sender)
    {
        require(address(_aToken) != address(0), "invalid aToken");
        aToken = _aToken;
    }

    function decimals() public pure override returns (uint8) {
        return _decimals;
    }

    function totalAssets() public view override returns (uint256) {
        return aToken.balanceOf(address(this));
    }
    
    /**
     * Override the conversion functions to use virtual assets/shares.
     * This ensures:
     * - Initial deposits get 1:1 share conversion (prevents share inflation)
     * - Accumulated yield is accounted for fairly across all share holders
     * - Formula: shares = assets × (totalSupply + virtualShares) / (totalAssets + virtualAssets)
     */
    function _convertToShares(uint256 assets, Math.Rounding rounding) internal view override returns (uint256) {
        uint256 supply = totalSupply();
        uint256 assets_ = totalAssets();
        return (assets == 0 || supply == 0) 
            ? assets 
            : assets.mulDiv(supply + VIRTUAL_SHARES, assets_ + VIRTUAL_ASSETS, rounding);
    }

    function _convertToAssets(uint256 shares, Math.Rounding rounding) internal view override returns (uint256) {
        uint256 supply = totalSupply();
        uint256 assets_ = totalAssets();
        return (shares == 0 || supply == 0) 
            ? shares 
            : shares.mulDiv(assets_ + VIRTUAL_ASSETS, supply + VIRTUAL_SHARES, rounding);
    }

    // --- deposit / mint track principal --- //
    function deposit(uint256 assets, address receiver) public override returns (uint256 shares) {
        require(assets > 0, "zero assets");
        require(receiver != address(0), "zero receiver");

        shares = previewDeposit(assets);
        require(aToken.transferFrom(msg.sender, address(this), assets), "transfer failed");
        _mint(receiver, shares);

        userPrincipal[receiver] += assets;
        totalPrincipal += assets;

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function mint(uint256 shares, address receiver) public override returns (uint256 assets) {
        require(shares > 0, "zero shares");
        require(receiver != address(0), "zero receiver");

        assets = previewMint(shares);
        require(aToken.transferFrom(msg.sender, address(this), assets), "transfer failed");
        _mint(receiver, shares);

        userPrincipal[receiver] += assets;
        totalPrincipal += assets;

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    // --- withdraw / redeem reduce principal proportionally --- //
    function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256 shares) {
        require(assets > 0, "zero assets");
        require(receiver != address(0), "zero receiver");

        shares = previewWithdraw(assets);

        if (msg.sender != owner) {
            uint256 allowed = allowance(owner, msg.sender);
            require(allowed >= shares, "insufficient allowance");
            _approve(owner, msg.sender, allowed - shares);
        }

        uint256 ownerSharesBefore = balanceOf(owner);
        require(ownerSharesBefore >= shares, "insufficient shares");

        if (userPrincipal[owner] > 0) {
            uint256 principalReduction = (userPrincipal[owner] * shares) / ownerSharesBefore;
            userPrincipal[owner] -= principalReduction;
            totalPrincipal -= principalReduction;
            emit PrincipalReduced(owner, principalReduction);
        }

        _burn(owner, shares);
        require(aToken.transfer(receiver, assets), "transfer failed");

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) public override returns (uint256 assets) {
        require(shares > 0, "zero shares");
        require(receiver != address(0), "zero receiver");

        assets = previewRedeem(shares);

        if (msg.sender != owner) {
            uint256 allowed = allowance(owner, msg.sender);
            require(allowed >= shares, "insufficient allowance");
            _approve(owner, msg.sender, allowed - shares);
        }

        uint256 ownerSharesBefore = balanceOf(owner);
        require(ownerSharesBefore >= shares, "insufficient shares");

        if (userPrincipal[owner] > 0) {
            uint256 principalReduction = (userPrincipal[owner] * shares) / ownerSharesBefore;
            userPrincipal[owner] -= principalReduction;
            totalPrincipal -= principalReduction;
            emit PrincipalReduced(owner, principalReduction);
        }

        _burn(owner, shares);
        require(aToken.transfer(receiver, assets), "transfer failed");

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    // available yield = totalAssets - totalPrincipal - totalAllocatedSubsidy
    function availableYield() public view returns (uint256) {
        uint256 assets = totalAssets();
        if (assets <= totalPrincipal + totalAllocatedSubsidy) return 0;
        return assets - totalPrincipal - totalAllocatedSubsidy;
    }

    /**
     * getInterestSubsidy:
     * - interestInMXNB (6 decimals) from DebtLens
     * - oraclePrice = MXNB per WaUSDC scaled by 1e36
     * - Calculate subsidy in waUSDC equivalent: waUSDC = interestInMXNB * 1e36 / oraclePrice
     * - Convert to aUSDC units using vault's current conversion rate
     * - Adjust stored reservation to desired (delta logic) so repeated calls are safe
     * 
     * Emits detailed debugging info: interestInMXNB, subsidyInWaUSDC, desiredInAUSDC, delta
     */
    function getInterestSubsidy(address user) external returns (uint256 newReserved) {
        require(user != address(0), "zero user");
        require(debtLens != address(0) && mxnbUsdcOracle != address(0), "integrations not set");

        uint256 interestInMXNB = IDebtLens(debtLens).getAccruedInterest(marketId, user);
        userInterestInMXNB[user] = interestInMXNB;

        if (interestInMXNB == 0) {
            uint256 cur = userInterestSubsidyInWaUSDC[user];
            if (cur > 0) {
                userInterestSubsidyInWaUSDC[user] = 0;
                totalAllocatedSubsidy -= cur;
                emit SubsidyRevoked(user, cur);
            }
            return 0;
        }

        uint256 oraclePrice = IWaUSDCMXNBOracle(mxnbUsdcOracle).price();
        require(oraclePrice > 0, "oracle price 0");

        // Calculate subsidy in waUSDC-equivalent units
        uint256 subsidyInWaUSDC = (interestInMXNB * 1e36) / oraclePrice;
        
        // Convert to aUSDC (aToken) units using vault's current conversion rate
        // This ensures subsidy amount is in the same units (aUSDC) that get transferred
        uint256 desired = _convertToAssets(subsidyInWaUSDC, Math.Rounding.Floor);

        uint256 current = userInterestSubsidyInWaUSDC[user];

        if (desired == current) {
            emit SubsidyRequested(user, interestInMXNB, subsidyInWaUSDC, desired, desired, 0);
            return desired;
        } else if (desired > current) {
            uint256 delta = desired - current;
            uint256 avail = availableYield();
            require(delta <= avail, "insufficient available yield");
            userInterestSubsidyInWaUSDC[user] = desired;
            totalAllocatedSubsidy += delta;
            emit SubsidyRequested(user, interestInMXNB, subsidyInWaUSDC, desired, desired, delta);
            return desired;
        } else {
            // desired < current -> free up difference
            uint256 decrease = current - desired;
            userInterestSubsidyInWaUSDC[user] = desired;
            totalAllocatedSubsidy -= decrease;
            emit SubsidyRevoked(user, decrease);
            return desired;
        }
    }

    /**
     * redeemWithInterestSubsidy:
     * - burns shares
     * - reduces principal proportionally
     * - uses stored subsidy (capped by availableYield)
     * - transfers principalReduction + subsidy to receiver
     * - tracks userPaidSubsidyInUSDC for the user
     * - vault keeps extra yield (principal share of yield not transferred)
     * 
     * Emits: principalReduced, subsidyPaid, totalOutput, availableYield for debugging
     */
    function redeemWithInterestSubsidy(uint256 shares, address receiver, address owner) external returns (uint256 totalOut) {
        require(shares > 0, "zero shares");
        require(receiver != address(0), "zero receiver");

        if (msg.sender != owner) {
            uint256 allowed = allowance(owner, msg.sender);
            require(allowed >= shares, "insufficient allowance");
            _approve(owner, msg.sender, allowed - shares);
        }

        uint256 ownerSharesBefore = balanceOf(owner);
        require(ownerSharesBefore >= shares, "insufficient shares");

        uint256 principalReduction = 0;
        if (userPrincipal[owner] > 0) {
            principalReduction = (userPrincipal[owner] * shares) / ownerSharesBefore;
            userPrincipal[owner] -= principalReduction;
            totalPrincipal -= principalReduction;
            emit PrincipalReduced(owner, principalReduction);
        }

        uint256 stored = userInterestSubsidyInWaUSDC[owner];
        uint256 subsidyToUse = 0;
        userPaidSubsidyInUSDC[owner] = 0;
        if (stored > 0) {
            uint256 avail = availableYield();
            subsidyToUse = stored <= avail ? stored : avail;
            if (subsidyToUse > 0) {
                // Track how much subsidy was actually paid to this user
                userPaidSubsidyInUSDC[owner] = subsidyToUse;
                
                uint256 availableAfter = availableYield();
                emit SubsidyUsed(owner, principalReduction, subsidyToUse, principalReduction + subsidyToUse, availableAfter);
            }
            totalAllocatedSubsidy -= userInterestSubsidyInWaUSDC[owner];
            userInterestSubsidyInWaUSDC[owner] = 0;
        }

        totalOut = principalReduction + subsidyToUse;

        _burn(owner, shares);
        require(aToken.transfer(receiver, totalOut), "transfer failed");

        emit Withdraw(msg.sender, receiver, owner, totalOut, shares);
    }

    function withdrawAccumulatedYield(uint256 amount, address recipient)
        external
        onlyOwner
    {
        require(amount > 0, "Cannot withdraw zero");
        require(recipient != address(0), "Invalid recipient");
        
        uint256 available = availableYield();
        require(amount <= available, "Insufficient accumulated yield");

        // Transfer aUSDC to recipient
        require(aToken.transfer(recipient, amount), "Transfer failed");

        emit YieldWithdrawn(recipient, amount, block.timestamp);
    }

    function withdrawAllAccumulatedYield(address recipient)
        external
        onlyOwner
    {
        require(recipient != address(0), "Invalid recipient");
        
        uint256 available = availableYield();

        // Transfer aUSDC to recipient
        require(aToken.transfer(recipient, available), "Transfer failed");

        emit YieldWithdrawn(recipient, available, block.timestamp);
    }

    // admin setters
    function setDebtLens(address _debtLens) external onlyOwner {
        require(_debtLens != address(0), "invalid");
        emit DebtLensUpdated(debtLens, _debtLens);
        debtLens = _debtLens;
    }

    function setMXNBUsdcOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "invalid");
        emit MXNBUsdcOracleUpdated(mxnbUsdcOracle, _oracle);
        mxnbUsdcOracle = _oracle;
    }

    function setMarketId(bytes32 _marketId) external onlyOwner {
        emit MarketIdUpdated(marketId, _marketId);
        marketId = _marketId;
    }
}