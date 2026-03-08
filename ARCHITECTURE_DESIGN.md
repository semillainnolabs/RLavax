# Architecture Design Overview

## Main Components

The RapiLoans solution is composed of three primary layers: the User Interface, the Custom Protocol Logic (Middle Layer), and the Underlying DeFi Primitives (Base Layer).

### 1. User Interface (Client Layer)
*   **Dashboard**: Displays user balances (USDC, MXNB), current loan status, health factor, and available liquidity.
*   **Transaction Manager**: Handles the sequence of approvals and contract calls required for borrowing and repaying.
*   **Wallet Provider**: Integrated via Privy to manage user sessions and signing capabilities.

### 2. Custom Protocol Logic (Middle Layer)
*   **WaUSDC Vault (Smart Contract)**:
    *   **Role**: Collateral Manager & Yield Stripper.
    *   **Function**: Accepts USDC, converts it to aUSDC (Aave), and mints `WaUSDC`. It holds the logic to calculate how much yield a user's collateral has generated and reserves it for the interest subsidy.
*   **DebtLens (Smart Contract)**:
    *   **Role**: Data Aggregator.
    *   **Function**: precise off-chain and on-chain calculation of user debt positions on Morpho Blue to determine solvency and repayment amounts.
*   **Oracle**:
    *   **Role**: Price Feed.
    *   **Function**: Determines the real-time exchange rate between `WaUSDC` and `MXNB`.

### 3. DeFi Primitives (Base Layer)
*   **Aave V3**:
    *   **Role**: Yield Generator.
    *   **Function**: Generates passive income on the deposited USDC collateral. This yield is the "fuel" for the 0% interest subsidy.
*   **Morpho Blue**:
    *   **Role**: Lending Engine.
    *   **Function**: Handles the actual loan logic—LTV checks, liquidations, and borrowing/repaying of MXNB against WaUSDC collateral.

## Technical Structure & Workflows

### Workflow A: The "Zero-Interest" Borrowing Flow
This workflow transforms a standard user deposit into a subsidized loan position.

1.  **User Entry**: User initiates a loan for $X MXNB.
2.  **Collateralization**:
    *   User's USDC is moved to **Aave**.
    *   Aave returns `aUSDC` (yielding token).
    *   `aUSDC` is wrapped into `WaUSDC` (non-yielding for user).
3.  **Lending**:
    *   `WaUSDC` is supplied to **Morpho Blue** as collateral.
    *   User borrows **MXNB** against this collateral.
4.  **Result**: User holds MXNB. Their collateral (in Aave) is earning yield, which the protocol captures.

### Workflow B: Repayment & Subsidy Realization
When the user returns to repay the loan:

1.  **Repayment**: User pays back the `MXNB` principal + accrued Morpho interest.
2.  **Unlocking**: Collateral (`WaUSDC`) is released from Morpho.
3.  **Subsidy Calculation**:
    *   User redeems `WaUSDC` for USDC.
    *   The Vault calculates the yield generated during the loan period.
    *   **The Subsidy**: The protocol checks the interest paid vs. yield generated. If yield > interest, the user might essentially have paid 0% net cost (or the protocol covers the interest).
    *   *Implementation Note*: In the current codebase, the user is shown a message "We've subsidized your loan interest!!!" and the logic tracks `userPaidSubsidyInUSDC`, effectively rebating the cost using the captured yield.

## Diagrammatic Overview

```mermaid
graph TD
    User[User] -->|1. Deposit USDC | Aave[Aave V3]
    User[User] -->|2. Deposit aUSDC | WaUSDC[WaUSDC Vault]
    WaUSDC -->|3. Mint WaUSDC Token| User
    Aave -->|4. Yield (aUSDC)| WaUSDC
    
    User -->|5. Supply WaUSDC Collateral| Morpho[Morpho Blue Market]
    Morpho -->|6. Borrow MXNB| User
    
    subgraph "Subsidy Mechanism"
    Aave -.->|Yield Flow| WaUSDC
    WaUSDC -.->|Offset Interest| User
    end
```
