import PrestamoRapido from "@/components/PrestamoRapido";

export default function Page() {
    return (
        <main>


            <div className="relative z-20 flex flex-col items-center gap-8 w-full py-18 mt-5 sm:mt-0 sm:py-5">
                <div className="text-center space-y-4">
                    <h1 className="text-5xl text-white font-bold tracking-tighter">
                        RapiLoans
                    </h1>
                    <p className="text-gray-200 max-w-lg mx-auto text-lg">
                        Instant loans in MXNB using your USDC as collateral.
                        <br />
                    </p>
                </div>

                <PrestamoRapido />

                <div className="text-xs text-white mt-8 max-w-md text-center">
                    <p>By depositing, you accept the protocol's terms and conditions.</p>
                    <p>Max LTV: 50% | Oracle: Chainlink</p>
                </div>
            </div>
        </main>
    );
}