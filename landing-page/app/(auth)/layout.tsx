export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-black text-white">
            {/* Background gradients */}
            <div className="absolute top-0 left-0 w-full h-full bg-black" />

            {/* Deep Blue/Cyan Base Fog */}
            <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse-slow" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '4s' }} />

            {/* Throbbing "Spotlights" */}
            <div className="absolute top-[20%] left-[50%] -translate-x-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[80px] animate-throb-light" />
            <div className="absolute bottom-[20%] right-[20%] w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[90px] animate-throb-light" style={{ animationDelay: '2s' }} />

            {/* Foggy Overlay */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[20px]" />

            {/* Content */}
            <div className="w-full max-w-md p-4 relative z-10 animate-fade-in-up">
                {children}
            </div>
        </div>
    );
}
