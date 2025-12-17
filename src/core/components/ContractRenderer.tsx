
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Scroll, PenTool, CheckCircle } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

interface ContractRendererProps {
    markdown: string;
}

export default function ContractRenderer({ markdown }: ContractRendererProps) {
    const [signed, setSigned] = React.useState(false);
    const toast = useToast();

    const handleSign = () => {
        setSigned(true);
        toast.success("Contract signed successfully!");
    };

    return (
        <div className="bg-[#fdfbf7] text-[#1a1a1a] rounded-sm shadow-2xl my-6 max-w-3xl mx-auto border border-[#dcd6cc] relative overflow-hidden">
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                <Scroll size={400} />
            </div>

            {/* Header */}
            <div className="bg-[#1a1a1a] text-[#fdfbf7] p-4 text-center border-b-4 border-[#c0b4a0]">
                <h2 className="text-xl font-serif tracking-widest uppercase">Legal Agreement</h2>
                <div className="text-[10px] opacity-70 mt-1 font-mono uppercase">Drafted by IndiiOS Legal Agent</div>
            </div>

            {/* Content */}
            <div className="p-8 md:p-12 prose prose-sm md:prose-base max-w-none font-serif prose-headings:font-sans prose-headings:uppercase prose-headings:tracking-wider prose-headings:text-black prose-p:text-[#2c2c2c] prose-li:text-[#2c2c2c] prose-strong:text-black">
                <ReactMarkdown>{markdown}</ReactMarkdown>
            </div>

            {/* Signature Block */}
            <div className="bg-[#f0ece4] p-6 border-t border-[#dcd6cc] flex items-center justify-between">
                <div className="text-xs text-gray-500 font-mono w-1/2">
                    <p>ELECTRONIC SIGNATURE REQUESTED</p>
                    <p>ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                </div>

                {signed ? (
                    <div className="flex items-center gap-2 text-green-700 bg-green-100 px-4 py-2 rounded border border-green-200 shadow-sm animate-in fade-in zoom-in">
                        <CheckCircle size={18} />
                        <span className="font-bold uppercase text-sm tracking-wide">Signed</span>
                    </div>
                ) : (
                    <button
                        onClick={handleSign}
                        className="flex items-center gap-2 bg-[#1a1a1a] text-white px-6 py-2 rounded hover:bg-black transition-colors shadow-lg hover:shadow-xl active:scale-95 duration-200"
                    >
                        <PenTool size={16} />
                        <span className="font-bold uppercase text-sm tracking-wide">Sign Document</span>
                    </button>
                )}
            </div>
        </div>
    );
}
