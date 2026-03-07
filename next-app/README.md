> [!IMPORTANT]
> Due to the complexity of our logic/architecture, RapiLoans requires intensive testing and contract auditing before deployment to Mainnet. The PoC was deployed in Base Sepolia because that is the Testnet where official Aave and Morpho smart contracts are present. However, a working limited PoC was also built running in Avalanche Fuji (see Fuji-borrow-working branch) with Aave and Morpho mock contracts deployed by our team.

# RapiLoans 💰

**Instant MXNB loans. Zero interest. Powered by Avalanche.**

RapiLoans, by RapiMoni, enables users to access instant loans in MXNB (Bitso's Mexican Peso stablecoin) by collateralizing USDC, with **0% interest rates subsidized by the RapiLoans protocol**. Built on Avalanche for speed, low costs, and accessibility to the Latin American market.

---

## 📋 Pitch Deck Sections

### Problem

Latin American users face a "liquidity trap": they hold crypto or USD stablecoins to hedge against inflation, but traditional credit in local currency (like the Mexican Peso) is predatory, with interest rates often hitting 30%+. Existing DeFi lending options are equally insufficient for daily needs because they primarily offer USD-pegged loans with 5-15% APR borrowing costs and require high technical friction. This leaves millions of un/underbanked users unable to access affordable, local-currency liquidity without selling their assets and triggering tax events or losing their market positions.

**The Gap in Latin American Credit:**

- ❌ **Liquidity barriers**: Mexican and Latin American users struggle to access fast loans without KYC-heavy traditional banking, or really high interest rates (30% and more)
- ⏰ **Slow transaction times**: Traditional lending takes days; users need capital urgently
- 💳 **Limited local currency DeFi lending**: Traditional DeFi offers few/no options for borrowing in local fiat-backed stablecoins (like MXNE)
- ⚠️ **High DeFi borrowing costs**: Existing DeFi lending protocols charge 5-15% APY, in USD stablecoins, making short-term loans expensive

**The Scope:**

Latin America and other Global-South markets with large un/underbanked populations and high remittance flows. This matters because access to fast working capital (for merchants, remittances recipients, traders, freelancers, etc) directly improves economic inclusion, reduces FX friction, and enables crypto users to transact locally without converting to/from volatile crypto or enduring slow bank rails.

**The User:**
Our primary persona is "Mateo," a crypto-native freelancer (or small business owner) in Mexico. Mateo receives payments in USDC but has daily expenses (rent, payroll, supplies) in Mexican Pesos.

- **Needs**: Fast access to Mexican Pesos(MXNB) without selling his dollars(USDC) or navigating a 3-day bank approval process with an extremely high loan denial rate.
- **Goals**: Maintain his long-term savings in dollars(USDC) while using it as leverage for short-term working capital or local purchasing power; avoid costly bank loans and FX spreads.
- **Frustrations**: Predatory local bank rates (30%+), high gas fees on other chains, lack of DeFi protocols that support local stablecoins like MXNB, severe loan denials due to a lack of formal credit history, slow bank transfers, complex onboarding

This is primarily B2C (consumers, small merchants), with B2B extensions (merchant payouts, remittance integrators) later.

### Solution

**RapiLoans: Instant. Affordable. Borderless.**

RapiLoans provides:
- ✅ **0% interest rate** — Ingeniously subsidized by capturing Aave USDC yield from collateral
- ⚡ **Instant liquidity** — Borrow MXNB in minutes, not days
- 🔒 **Overcollateralization model** — Supply USDC, borrow MXNB with predictable liquidation mechanics and 50% LTV for derisking
- 🌐 **Non-custodial** — Users maintain full control via smart contracts on Avalanche
- 📱 **Simple UX** — Intuitive web interface for wallet connection, collateral supply, and borrowing
- 💎 **Sustainable model** — Lenders earn base Morpho yield plus USDC rewards coming from the Aave USDC yield generated (6-15% APY); protocol revenue comes from yield spread, not user extraction

### Market Opportunity

**tam (Total Addressable Market):**
- 🇲🇽 Mexico: ~50M+ unbanked/underbanked population
- 🌎 Latin America: 240M+ users with limited access to affordable credit
- 💰 Global emerging-market lending: $100B+ annual market

**Target Market Size (First Year):**
- Conservative: $10M in TVL (Total Value Locked)
- Protocol can capture 0.5-1% of annual emerging-market lending demand

### Customer Segments

1. **Crypto-Native Traders & Arbitrageurs**
   - Use USDC to take leveraged positions in MXNB
   - Need fast, cheap capital for short-term opportunities

2. **Mexican & Latin American Crypto Users**
   - Want to borrow in local currency equivalents (MXNB)
   - Avoid traditional banking friction and high rates

3. **Remittance & Cross-Border Payment Users**
   - Receive USDC internationally, borrow MXNB locally
   - Perfect for migrant workers sending money home

4. **Small Businesses & Merchants**
   - Accept crypto payments, need quick access to local currency
   - Use RapiLoans for working capital without KYC delays

5. **Developers & DAOs**
   - Build on top of RapiLoans' lending primitives
   - Create derivatives, insurance products, or payment rails

### Competitive Advantages

| Feature | RapiLoans | Traditional Banks | Other DeFi Protocols |
|---------|-----------|-------------------|---------------------|
| **Interest Rate** | 0% (subsidized) | 20-30% | 5-15% APY |
| **Speed** | Minutes | 3-5 days | Minutes |
| **KYC Required** | No | Yes | No |
| **Local Currency** | MXNB | MXN + fees | Limited options |
| **Non-Custodial** | Yes | No | Yes |
| **Chain** | Avalanche | N/A | Multiple / Expensive |

### Go-to-Market Strategy

**Phase 1 (Launch):**
- Target crypto traders on Avalanche with $1K–$100K USDC collateral
- Partner with Bitso community for MXNB awareness
- Airdrop incentives for early lenders/borrowers

**Phase 2 (Scale):**
- Expand to remittance users via partnerships with payment apps
- Introduce governance token for protocol revenue sharing
- Launch insurance / liquidation pools

**Phase 3 (Ecosystem):**
- Enable borrowing in additional local stablecoins (ARS, BRL, COP)
- Build merchant API for point-of-sale crypto integration
- Create incentive programs for protocol adoption

---

## 🚀 How It Works

### The User Journey

```
1. Supply USDC as Collateral
   └─> Your USDC earns yield via Aave protocol

2. Receive Yield-Bearing Collateral
   └─> aUSDC (aaveToken) wrapped into WaUSDC (ERC-4626 vault)

3. Borrow MXNB Against Collateral
   └─> Up to 50% LTV on your collateral value
   └─> 0% interest rate 🎉

4. Use MXNB Instantly
   └─> Trade, spend, or convert as needed

5. Repay Anytime
   └─> Return MXNB to unlock collateral + subsidy
```

### Technical Architecture

**Built on Avalanche with Morpho Blue:**

- **Aave USDC Vault** → Supply USDC, earn yield
- **WaUSDC (ERC-4626 Wrapper)** → Non-rebasing collateral asset
- **Morpho Blue Markets** → Uncensorable lending engine
- **Custom Oracle** → USDC/MXNB price feed for safety
- **Frontend UI** → Simple, non-custodial interface

**Why Avalanche?**
- ⚡ Low transaction costs (sub-cent)
- 🚀 High throughput 
- 🌱 Thriving DeFi ecosystem
- 🏦 Native support for multiple assets

---

## ✨ Key Features

- ✅ **0% Interest Rate (APR) for borrowers** — Subsidized by the protocol, coming from the USDC yield
- ✅ **Instant Liquidity** — Borrow in minutes via Avalanche's speed
- ✅ **Yield-Bearing Collateral** — Generating yield while user is borrowing
- ✅ **Rewards & Incentives** — Community-auditable smart contracts
- ✅ **Non-Custodial** — Full control via smart contracts
- ✅ **Transparent Oracles** — On-chain pricing for collateral safety
- ✅ **ERC-4626 Compliance** — Standard-compliant yield vault
- ✅ **Mobile-Friendly UI** — MetaMask / Web3 wallet integration

---

## 💰 Revenue Model: Yield Accumulation & Protocol Subsidies

### The Clever Mechanism: How 0% APR is Sustainable

RapiLoans' 0% APR isn't a loss-leader—it's powered by an ingenious **yield accumulation mechanism** that generates protocol revenue while subsidizing borrower APR:

```
USDC Deposits → Aave Yield → Protocol Capital → 0% APR + Rewards(Optional)
```

### Step-by-Step: The Yield Flow

**1. Borrower Deposits USDC**
- User deposits USDC into **Aave USDC Vault**
- Aave generates yield by lending USDC at ~5-8% market rates

**2. Yield Capture via WaUSDC**
- USDC deposits are wrapped into **aUSDC** (Aave vault token)
- aUSDC is wrapped again into **WaUSDC** (non-rebasing ERC-4626)
- WaUSDC **tracks yield** separately from principal
- As Aave's aUSDC appreciates, WaUSDC's price per share increases
- Yield remains with the protocol and collateral layer until withdrawal

**3. Borrower Uses WaUSDC as Collateral at 0% APR**
- Borrower locks WaUSDC as collateral
- Borrows MXNB at **0% interest rate** (fully subsidized)
- Collateral continues earning Aave yield in the background

**4. Protocol Captures Yield at Repayment**
- When borrower repays MXNB loan, RapiLoans retrieves accrued interest from Aave's Vaults
- Converts MXNB interest to WaUSDC equivalent via oracle
- **Uses protocol-owned yield to pay back the interest subsidy in USDC**
- Any excess yield becomes protocol revenue, and it is available for rewards and incentives for lenders/borrowers

### Revenue Streams

| Revenue Source | Amount | Use Case |
|----------------|--------|----------|
| **Yield Spread** | 4-10% annual on USDC's TVL | Protocol buffer & rewards reserve |
| **Excess Yield** | After subsidy coverage | DAO treasury, governance token buyback |
| **Incentive Rewards** | Portion of spread | Lender APY boost (attract capital) |
| **Borrower Penalties** | Late repay fees | Risk management, insurance pool |

### Example Calculation

**Scenario: $10M TVL in Aave USDC Vault**

```
Annual USDC Collateral TVL:       $10M
├─ Loans Generated:               $5M (up to 50% of $10M USDC collateral)
├─ USDC Yield Generated:          $500,000 (5% of $10M USDC collateral)
├──  Loan Interest Subsidies:       $250,000 (up to 50% of yield as APR subsidies)
├──  Lender Incentives:             $150,000 (up to 30% of yield as Bonus APY)
└──  Protocol Revenue:              $100,000 (up to 20% of yield kept by DAO/treasury)
```

### The GTM Advantage

This model is a **game-changing Go-to-Market strategy**:

✅ **Attract Early MXNB Lenders:**
- Lenders earn Morpho yield (5-10% base) + up to 30% of USDC yield as incentive APY
- Total yield: **7-13% APY** (far better than traditional options)

✅ **Subsidize Borrowers to Scale:**
- 0% APR costs nothing to borrowers
- Drives rapid borrowing growth and TVL expansion
- Borrowers gain capital at no cost—incentivizing platform usage

✅ **Sustainable Protocol Revenue:**
- Never dependent on borrower APR or fees
- Revenue comes from natural Aave yield, not extraction
- Scalable: More TVL = More yield = More sustainable

✅ **Network Effects:**
- Lenders attracted by high yields
- Borrowers attracted by 0% APR
- Both sides grow simultaneously
- Protocol earns from the spread, not the users

### Why This Matters for Profitability

**Traditional DeFi Models:**
- Borrow APY: 8-15%
- Lend APY: 5-8%
- Spread: 3-7% to protocol ✓
- Problem: Users resist high borrowing costs

**RapiLoans Model:**
- Borrow APY: 0% (subsidized from yield)
- Lend APY: 7-13%% (Morpho + incentives)
- Spread: 10-20% to protocol from USDC yield ✓
- Advantage: Users flock to better rates; TVL grows faster; revenue scales massively

---

## 🛠️ Technology Stack

**Smart Contracts:**
- Solidity (EVM-compatible)
- Morpho Blue protocol integration
- Aave protocol integration
- ERC-20 & ERC-4626 standards

**Frontend:**
- Next.js / React
- Ethers.js v6 for blockchain interaction
- MetaMask + Privy wallet integration
- TailwindCSS for styling

**Infrastructure:**
- Avalanche Mainnet (official deployment chain)
- The Graph for subgraph indexing
- IPFS for decentralized storage

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- MetaMask or compatible Web3 wallet
- ETH, USDC and MXNB on Base Sepolia

### Installation

```bash
# Clone the repository
git clone https://github.com/devbambino/RMLoans.git
cd RMLoans

# Install dependencies
cd next-app
pnpm install

# Copy the example environment file and configure your Privy app credentials:
cp .env.example .env.local

# Update `.env.local` with your Privy app credentials:
# Public - Safe to expose in the browser
NEXT_PUBLIC_PRIVY_APP_ID=your_app_id_here

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Deployment to Base Sepolia for testing

You need to follow these steps:
```bash
# 1. Deploy WaUSDC, and oracle contracts (if needed)
# 2. Create USDC/MXNB lending market on Morpho Blue
# 3. Output market IDs for frontend configuration
```

**Update frontend configuration:**
Edit `next-app/src/constants/contracts.ts` with deployed contract addresses from the output.

---

## 💻 Smart Contract Overview

### 1. **MockMXNB.sol**
ERC-20 token representing Mexican Peso stablecoin. 
- 6 decimals (matches USDC)
- Owner-controlled minting for initial liquidity

### 2. **WaUSDC.sol**
ERC-4626 vault wrapper around Morpho's aUSDC token.
- Non-rebasing shares for collateral composability
- Price per share increases as Aave yields accrue
- Enables collateral to earn yield while borrowed

### 3. **WausdcMxnbOracle.sol**
Price oracle providing WmUSDC/MXNB exchange rate for Morpho Blue markets.
- Safe pricing for risk management
- 77% LTV (Loan-to-Value) ratio

### 4. **MXNBFaucet.sol** (Testnet)
Faucet contract for minting test MXNB tokens during development.

---

## 📊 Morpho Blue Market Configuration

**RapiLoans creates one primary market:**

```
Market: MXNB Loan / WaUSDC Collateral
├─ Loan Token: MXNB
├─ Collateral Token: WaUSDC (non-rebasing shares)
├─ Oracle: WmusdcMxnbOracle
├─ Interest Rate Model: 0% (protocol-subsidized)
├─ LTV: 50% (derisking)
└─ LLTV: 77% (liquidation safety)
```

**Health Factor Formula:**
```
Health Factor = (Collateral Value × LTV) / Borrowed Value

Must remain > 1.0 to avoid liquidation
```
---

## 📱 Frontend Features

**Dashboard:**
- Real-time wallet balance display (USDC, MXNB, WaUSDC)
- Active loan status and liquidation risk
- APY and yield tracking

**Lending:**
- Deposit USDC → Mint aUSDC from Aave
- Wrap aUSDC → WaUSDC (ERC-4626)
- Supply WaUSDC as collateral

**Borrowing:**
- Borrow MXNB against WaUSDC collateral
- See real-time borrowing capacity
- Track health factor

**Repayment:**
- Repay MXNB loans anytime, with no penalties
- Withdraw collateral
- Claim accrued yield

---

## 🌐 Avalanche Network Details

**Official RapiLoans Chain:** Avalanche

- **Chain ID:** 43113
- **RPC:** https://api.avax-test.network/ext/bc/C/rpc
- **Block Explorer:** ttps://subnets-test.avax.network/
- **Gas Token:** AVAX (native)

**Why Avalanche?**
- Ultra-low transaction fees 
- Fast finality (sub-second)
- EVM-compatible (deploy Ethereum contracts unchanged)
- Thriving DeFi ecosystem with deep liquidity
- Strategic choice for Latin American accessibility

---

## 📚 Core Integrations

| Component | Provider | Purpose |
|-----------|----------|---------|
| **Yield** | Aave USDC Vault | Earn on supplied USDC |
| **Collateral** | WaUSDC (ERC-4626) | Non-rebasing wrapper for safety |
| **Lending Engine** | Morpho Blue | Un-censorable market protocol |
| **Pricing** | WmusdcMxnbOracle | Safe collateral valuation |
| **Wallet** | MetaMask / Privy | User custody & authentication |

---

## 🔐 Security & Auditing

**Current Status:** Beta / Audit-Ready

**Security Features:**
- ✅ Non-rebasing collateral design (prevents flash loan attacks)
- ✅ Conservative 50% LTV (liquidation buffer)
- ✅ Morpho Blue's battle-tested lending engine
- ✅ Transparent on-chain pricing
- ✅ No external price dependencies (decentralized oracles)

---

## 🗺️ Roadmap

**Q1 2026:**
- ✅ Launch on Avalanche Mainnet
- ✅ Core USDC/MXNB market live
- Target: $1M initial TVL

**Q2 2026:**
- Governance token ($MONI) introduction
- Protocol revenue sharing with stakers
- Remittance partnership pilots

**Q3 2026:**
- Expand to additional stablecoins (ARS, BRL, COP)
- Mobile app release
- Cross-chain bridging (Arbitrum, Solana, Base)

**Q4 2026 & Beyond:**
- Merchant API for point-of-sale integration
- Synthetic asset pools
- Community governance transitions to DAO

---

## 📞 Support & Community

- **Twitter:** [@semillainnolabs](#)
- **GitHub Issues:** Report bugs and feature requests

---

## 🙏 Acknowledgments

Built with ❤️ by the SemillaLabs team.  
Powered by **Avalanche**, **Morpho Blue** and Bitso/Juno

Special thanks to:
- [Morpho Labs](https://morpho.org/) for the lending protocol
- [Aave](https://aave.com/) for the yield 
- [Bitso](https://bitso.com/) for MXNB innovation
- [Avalanche](https://www.avax.network/) for ecosystem support

---

**Status:** 🚀 Ready for Base Sepolia and Avalanche Fuji  
**Last Updated:** March 2026  