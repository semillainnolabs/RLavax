"use client"
import Image from 'next/image';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation'; // Importante para UX de navegación
import { usePrivy } from '@privy-io/react-auth';

export default function Header() {
    const [isOpen, setOpen] = useState(false);
    const { ready, authenticated, user, logout } = usePrivy();
    const pathname = usePathname(); // Hook para saber la ruta actual
    const [copied, setCopied] = useState(false); // Estado para feedback de copia

    const loggedOutLinks = [
        { href: '/borrow', key: 'Borrow' },
        { href: '/lend', key: 'Lend' },
    ];

    const loggedInLinks = [
        { href: '/borrow', key: 'Borrow' },
        { href: '/lend', key: 'Lend' },
        { href: '/manage', key: 'Manage' },
    ];

    // Función mejorada: Copiar address al click
    const handleCopyAddress = () => {
        if (user?.wallet?.address) {
            navigator.clipboard.writeText(user.wallet.address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const formatAddress = (address: string | undefined) => {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    // --- COMPONENTE DE NAVEGACIÓN (LINK) ---
    // Abstraído para manejar estilos de estado activo
    const NavLink = ({ href, children, onClick }: { href: string, children: React.ReactNode, onClick?: () => void }) => {
        const isActive = pathname === href;
        return (
            <Link
                href={href}
                onClick={onClick}
                className={`relative px-3 py-2 text-sm font-medium transition-all duration-300 ${isActive ? 'text-[#4fe3c3] ' : 'text-white '
                    }`}
            >
                {children}
                {/* Indicador brillante inferior si está activo */}
                {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-[#4fe3c3] shadow-[0_0_10px_#4fe3c3] rounded-full"></span>
                )}
            </Link>
        );
    };

    // --- SUB-COMPONENTE WALLET CHIPS MEJORADO ---
    const WalletChips = ({ isMobile = false }) => (
        <div className={`flex items-center ${isMobile ? 'flex-col items-start w-full gap-3' : 'gap-3'}`}>

            {/* Chip 1: Address con "Gradient Border" y Copiar */}
            <button
                onClick={handleCopyAddress}
                className="group cursor-pointer relative p-px rounded-full bg-linear-to-r from-gray-800 to-gray-700 hover:from-secondary hover:to-cyan-500 transition-all duration-500"
            >
                <div className="relative px-4 py-1.5 rounded-full bg-black/80 backdrop-blur-md flex items-center gap-2 transition-all group-hover:bg-black/90">
                    <div className={`w-2 h-2 rounded-full ${copied ? 'bg-green-500' : 'bg-secondary animate-pulse'}`}></div>
                    <span className="text-sm sm:text-sm text-gray-200 font-mono tracking-wide group-hover:text-white transition-colors">
                        {copied ? 'Copied!' : (user?.wallet?.address ? formatAddress(user.wallet.address) : '...')}
                    </span>
                    {/* Icono de copiar sutil */}
                    {!copied && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500 group-hover:text-secondary opacity-0 group-hover:opacity-100 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    )}
                </div>
            </button>

            {/* Chip 2: Minimal Disconnect Button */}
            <button
                onClick={() => {
                    logout();
                    if (isMobile) setOpen(false);
                }}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/20 text-sm font-medium text-red-400/80 hover:text-red-200 hover:bg-red-500/10 hover:border-red-500/40 transition-all duration-300 ${isMobile ? 'w-full justify-center' : ''}`}
            >
                <span>Disconnect</span>
            </button>
        </div>
    );

    // Efecto para bloquear el scroll cuando el menú móvil está abierto
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
    }, [isOpen]);

    return (
        <>
            {/* Nav Principal */}
            <header className={`font-main fixed top-0 w-full z-50 transition-all duration-300 bg-dark/80 backdrop-blur-xl supports-backdrop-filter:bg-dark/60`}>
                <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-4">

                    {/* Logo con efecto hover sutil */}
                    <Link href="/" className="relative z-50 transition-opacity hover:opacity-80">
                        {/* Asegúrate de que el logo tenga buena resolución */}
                        <Image src="/logo-sm.png" alt="RapiMoni" width={180} height={60} className="object-contain" priority />
                    </Link>

                    {/* --- DESKTOP NAV --- */}
                    <div className="hidden md:flex items-center gap-8">
                        <nav className="flex items-center gap-1">
                            {(ready && authenticated ? loggedInLinks : loggedOutLinks).map(link => (
                                <NavLink key={link.key} href={link.href}>
                                    {link.key}
                                </NavLink>
                            ))}
                        </nav>

                        {/* Separador sutil */}
                        {ready && authenticated && <div className="h-5 w-px bg-white/10"></div>}

                        {/* Wallet Chips */}
                        {ready && authenticated && (
                            <WalletChips isMobile={false} />
                        )}
                    </div>

                    {/* --- MOBILE BURGER BUTTON --- */}
                    <button
                        className="md:hidden relative z-50 p-2 text-gray-300 hover:text-white focus:outline-none"
                        onClick={() => setOpen(!isOpen)}
                    >
                        <div className="w-6 flex flex-col items-end gap-1.25">
                            <span className={`h-0.5 bg-current transition-all duration-300 ${isOpen ? 'w-6 rotate-45 translate-y-1.75' : 'w-6'}`}></span>
                            <span className={`h-0.5 bg-current transition-all duration-300 ${isOpen ? 'opacity-0' : 'w-4'}`}></span>
                            <span className={`h-0.5 bg-current transition-all duration-300 ${isOpen ? 'w-6 -rotate-45 -translate-y-1.75' : 'w-5'}`}></span>
                        </div>
                    </button>
                </div>
            </header>

            {/* --- MOBILE MENU OVERLAY --- */}
            {/* Fondo oscuro detrás del menú */}
            <div
                className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setOpen(false)}
            />

            {/* Drawer Deslizable */}
            <nav className={`font-main fixed top-0 right-0 z-40 h-full w-[80%] max-w-sm bg-dark border-l border-border shadow-2xl transform transition-transform duration-300 ease-out md:hidden flex flex-col pt-24 px-6 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Enlaces Móviles */}
                <div className="flex flex-col gap-2">
                    {(ready && authenticated ? loggedInLinks : loggedOutLinks).map((link) => {
                        const isActive = pathname === link.href;
                        return (
                            <Link
                                key={link.key}
                                href={link.href}
                                onClick={() => setOpen(false)}
                                className={`text-xl font-light py-3 border-b border-white/5 transition-colors ${isActive ? 'text-secondary pl-2' : 'text-light hover:text-white'
                                    }`}
                            >
                                {link.key}
                            </Link>
                        )
                    })}
                </div>

                {/* Footer del Menú Móvil */}
                {ready && authenticated && (
                    <div className="mt-auto mb-10">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                            <p className="text-sm text-gray-500 uppercase font-bold tracking-widest mb-4">
                                Connected Wallet
                            </p>
                            <WalletChips isMobile={true} />
                        </div>
                    </div>
                )}
            </nav>
        </>
    );
}