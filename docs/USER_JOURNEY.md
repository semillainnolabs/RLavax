# User Journey

This document outlines the step-by-step journey of a user interacting with the RapiLoans platform, from the initial landing to successfully managing a loan.

## Phase 1: Onboarding

### 1. Arrival & Connection
*   **Step**: User navigates to the RapiLoans web application.
*   **Interface**: They are greeted with a clean landing page explaining the value proposition: "Instant MXNB loans. Zero interest."
*   **Action**: User clicks the "Sign In/Up" button.
*   **System**: The app uses **Privy** to authenticate the user, supporting both traditional Web3 wallets (Metamask, etc.) and email/social logins for broader accessibility.

## Phase 2: Borrowing (The "Zale")

### 2. Loan Simulation
*   **Step**: User accesses the "Quick Loan" (Prestamo Rapido) section.
*   **Action**: User enters the amount of **MXNB** (Mexican Peso Stablecoin) they wish to borrow.
*   **System**: The UI instantly calculates and displays the **Required Deposit** in USDC.
    *   *Calculation*: Based on a safe Loan-to-Value (LTV) ratio (e.g., 50%) and the current Oracle price.
*   **Decision**: User reviews the required collateral and clicks "Borrow" (Execute Zale).

### 3. Execution (The Multi-Step Transaction)
The user approves a sequence of transactions handled by the application. The UI updates a progress stepper to keep the user informed:
1.  **Approving USDC**: User grants permission for the protocol to access their USDC.
2.  **Depositing in Aave**: The protocol deposits the USDC into Aave to start generating yield.
3.  **Wrapping Assets**: The received `aUSDC` is wrapped into `WaUSDC` (the protocol's collateral token).
4.  **Approving Collateral**: User grants permission for Morpho Blue to use their `WaUSDC`.
5.  **Supplying Collateral**: The `WaUSDC` is locked in the Morpho Blue lending market.
6.  **Borrowing**: The protocol borrows the requested **MXNB** and sends it to the user's wallet.
*   **Outcome**: User sees a "Success" screen confirming the receipt of MXNB.

## Phase 3: Management & Utilization

### 4. Dashboard Overview
*   **Step**: User visits the "Manage" or "Dashboard" page.
*   **Interface**: A grid view displays:
    *   **Assets**: Balances of USDC and MXNB.
    *   **Loan Status**: Current Debt (MXNB) and Collateral Used (USDC).
    *   **Health**: Liquidation risk indicators (e.g., LTV %).

### 5. Utilizing Funds
*   **Action**: The user is now free to use the borrowed **MXNB** in the external ecosystem (e.g., for payments, remittances, or trading) while their original USDC principal remains safe and working for them within the protocol.

## Phase 4: Repayment & Exit

### 6. Initiating Repayment
*   **Step**: User decides to close their loan position.
*   **Action**: User clicks "Repay & Withdraw" on the dashboard.

### 7. Settlement
The system executes the reverse workflow:
*   **Step**: User approves the spending of MXNB.
*   **Step**: The protocol repays the debt to Morpho Blue + accrued interest.
*   **Step**: The protocol withdraws the `WaUSDC` collateral.

### 8. Subsidy Realization
*   **Outcome**: The `WaUSDC` is unwrapped.
*   **The Magic**: The user receives their original USDC principal. The protocol calculates the subsidy generated from the Aave yield.
*   **Notification**: The user sees a message: **"We've subsidized your loan interest!!!"** showing the value saved/rebated.
*   **Final State**: Loan is closed, user has their collateral back, and they paid effectively zero (or significantly reduced) interest.
