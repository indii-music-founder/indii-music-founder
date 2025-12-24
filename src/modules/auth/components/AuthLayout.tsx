import React, { ReactNode } from 'react';

interface AuthLayoutProps {
    children: ReactNode;
    title: string;
    subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold tracking-tight mb-2">indiiOS</h1>
                    <h2 className="text-2xl font-semibold mt-6">{title}</h2>
                    {subtitle && <p className="text-zinc-400 mt-2">{subtitle}</p>}
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 shadow-xl backdrop-blur-sm">
                    {children}
                </div>

                <div className="text-center text-zinc-500 text-sm">
                    &copy; {new Date().getFullYear()} The Walking Agency
                </div>
            </div>
        </div>
    );
};
