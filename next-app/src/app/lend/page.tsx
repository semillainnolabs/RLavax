import RendimientoRapido from "@/components/RendimientoRapido";

export default function Page() {
    return (
        <main>
            <div className="relative z-20 flex flex-col items-center gap-8 w-full py-18 mt-5 sm:mt-0 sm:py-5">
                <div className="text-center space-y-4">
                    <h1 className="text-5xl font-bold tracking-tighter bg-clip-text text-white">
                        RapiLoans Yield
                    </h1>
                    <p className="text-gray-200 max-w-lg mx-auto text-lg">
                        Provide liquidity to our vault and generate passive returns in MXNB.
                        <br />
                    </p>
                </div>

                <RendimientoRapido />

                <div className="text-xs text-gray-200 mt-8 max-w-md text-center">
                    <p>By depositing, you accept the protocol's terms and conditions.</p>
                    <p>ERC4626 Vault | Active auto-compounding</p>
                </div>
            </div>
        </main>
    );
}
