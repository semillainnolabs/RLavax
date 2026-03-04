import { ethers } from 'ethers';

export const BASE_SEPOLIA_CONFIG = {
    chainId: 84532,
    rpcUrl: "https://sepolia.base.org",
    blockExplorer: "https://sepolia.basescan.org",
};

export const AVAX_FUJI_CONFIG = {
    chainId: 43113,
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    blockExplorer: "https://subnets-test.avax.network/",
};

export const CONTRACT_ADDRESSES = {
    // Avax Fuji Token Addresses
    usdc: "0x789D299321f194B47f3b72d33d0e028376277AA3",
    mockMXNB: "0x1DA5199ecaAe23F85c7fd7611703E81273041149",

    // Wrapper & Vault Addresses
    waUSDC: "0x9Eb972888Bc1D52B0cAB77ED00Cfd911Be92F44a",
    morphoMXNBVault: "0x",// pending to be deployed
    irm: "0x3623f733b587FE63F7365648312E007148a15bB5",

    // Aave
    aavePool: "0x2a2e2346404fab3b4B521f2eA4D052D5BA10aaB6",
    aUSDC: "0xC39F2C3522ed1C2E8bCb40D34445f6Eacc94bEBE",

    // Morpho Addresses
    morphoBlue: "0xBF36b45ccD42a178ac8b22e7271d87abbBE7c8a2",

    // Oracle Addresses
    fixedPriceOracle: "0xB376ebF210a64AE13A33DDB58047B6BF9E326330",
};

export const MARKET_IDS = {
    mxnb: "0x45e15b1dc3fcb1a89af05cbaf3e3029be4a95c7e021f799ec4fe283e11cbaac6",
};

// Morpho Blue Market Params Tuple
// [loanToken, collateralToken, oracle, irm, lltv]
export const MXNB_MARKET_PARAMS = {
    loanToken: CONTRACT_ADDRESSES.mockMXNB,
    collateralToken: CONTRACT_ADDRESSES.waUSDC,
    oracle: CONTRACT_ADDRESSES.fixedPriceOracle,
    irm: CONTRACT_ADDRESSES.irm,
    lltv: ethers.parseEther("0.77")
};

// ABIs
export const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
    "function name() external view returns (string)",
];

export const VAULT_ABI = [
    "function deposit(uint256 assets, address receiver) external returns (uint256)",
    "function withdraw(uint256 assets, address receiver, address owner) external returns (uint256)",
    "function redeem(uint256 shares, address receiver, address owner) external returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function asset() external view returns (address)",
    "function convertToShares(uint256 assets) external view returns (uint256)",
    "function convertToAssets(uint256 shares) external view returns (uint256)",
];

export const WMEMORY_ABI = [
    "function deposit(uint256 assets, address receiver) external returns (uint256)",
    "function redeem(uint256 shares, address receiver, address owner) external returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function getInterestSubsidy(address user) external returns (uint256)",
    "function redeemWithInterestSubsidy(uint256 shares, address receiver, address owner) external returns (uint256)",
    "function userInterestSubsidyInWmUSDC(address) view returns (uint256)",
    "function userInterestInMxnb(address) view returns (uint256)",
    "function userPaidSubsidyInUSDC(address) view returns (uint256)",
];

export const MORPHO_ABI = [
    "function supplyCollateral(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 amount, address onBehalf, bytes data) external",
    "function withdrawCollateral(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 amount, address onBehalf, address receiver) external",
    "function borrow(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) external returns (uint256, uint256)",
    "function repay(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) external returns (uint256, uint256)",
    "function position(bytes32 id, address user) external view returns (tuple(uint256 supplyShares, uint256 borrowShares, uint256 collateral))",
    "function market(bytes32 id) external view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
];

export const ORACLE_ABI = [
    "function price() external view returns (uint256)",
];

export const IRM_ABI = [
    "function borrowRateView(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, tuple(uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee) marketStatus) external view returns (uint256)",
];

export const AAVE_ABI = [
    "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external",
    "function withdraw(address asset, uint256 amount, address to) external returns (uint256)",
];
