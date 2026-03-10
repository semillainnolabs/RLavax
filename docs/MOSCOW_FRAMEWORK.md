# MoSCoW Framework for Feature Prioritization

This analysis prioritizes features for the RapiLoans protocol to guide development from Proof of Concept (PoC) to Mainnet Launch.

## Must Have (Critical for MVP/Launch)
*These features are non-negotiable for the system to function.*

1.  **Core Lending Engine**: Integration with Morpho Blue to enable supplying collateral and borrowing assets.
2.  **Yield Generation Engine**: Integration with Aave to enable yield generation of the USDC collateral.
3.  **Yield-Subsidy Vault (`WaUSDC`)**: The smart contract logic that wraps Aave USDC to capture yield. This is the core unique value proposition (0% interest).
4.  **Wallet Connection & Auth**: Seamless onboarding via Privy (critical for the crypto-native initial demographic).
5.  **Oracle Integration**: Reliable price feeds (`WaUSDCMXNBOracle`) to ensure loans are properly collateralized and the protocol is safe from bad debt.
6.  **Basic Repayment Flow**: The ability for users to close their position and retrieve their collateral.
7.  **Solvency Checks**: Frontend validations to prevent users from borrowing more than the LTV limit (preventing instant liquidation).

## Should Have (High Priority)
*These features are important but not vital for the very first transaction to work. They should be included as soon as possible.*

1.  **Email/Telephone SignIn/Up**: Seamless onboarding via Privy (critical for the target unbanked/crypto-native demographic).
2.  **Fiat Off Ramp with Avalanche Card**: Quick swap from loaned MXNB to USDC using DEXes, giving users instant USDC liquidity to be used in their Avalanche card for PoS payments, but a fixed MXNB debt, emulating a credit card with 0% interest.
3.  **User Dashboard**: A comprehensive view of "Health Factor" to warn users if they are close to liquidation.
4.  **Transaction History**: A log of user deposits, borrows, and repayments for transparency.
5.  **Subsidy Visualization**: Clear UI showing exactly how much interest is being offset by the yield in real-time (currently it shows at the end).
6.  **Flash Loan Repayment**: "One-click" repayment where users can use their collateral to pay off the debt (deleverage) without needing to hold liquid MXNB.

## Could Have (Nice to Have)
*These are desirable features that enhance experience but can be delayed.*

1.  **Liquidation Bot**: An automated off-chain bot to liquidate unhealthy positions (essential for protocol safety on Mainnet, though manual liquidation works for PoC).
2.  **Multi-Collateral Support**: Accepting other assets like RWAs(tokenized equities, treasuries, real state tokens, etc) as collateral (converting them to a yield-bearing equivalent).
2.  **Notification System**: Email or Push notifications (via Privy or Push Protocol) when LTV becomes risky.
3.  **Looping / Leverage**: 1-click "Loop" strategy (Deposit USDC -> Borrow MXNB -> Swap to USDC -> Deposit Again) for users who want to leverage the yield spread.
4.  **Fiat On/Off Ramp Integration**: Direct integration with providers (like Bitso API or Transak/Moonpay) to let users cash out MXNB to a bank account directly from the UI.

## Won't Have (Out of Scope for Now)
*These features are agreed to be excluded from the initial release.*

1.  **Native Mobile App**: The project will focus on a responsive Web App (PWA) first.
2.  **Governance DAO**: Decentralized governance token and voting mechanisms are too complex for the launch phase; the protocol will be admin-managed initially.
3.  **Cross-Chain Lending**: While the vision is borderless, the initial launch will focus on a single chain (Avalanche) to minimize bridge risks and complexity.
