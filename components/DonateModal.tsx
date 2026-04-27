import React from "react";

interface DonateModalProps {
	isOpen: boolean;
	onClose: () => void;
	t: any;
}

const DonateModal: React.FC<DonateModalProps> = ({ isOpen, onClose, t }) => {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-md"
				onClick={onClose}></div>

			<div className="relative w-full max-w-[320px] glass-morphism border border-white/20 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
				<button
					onClick={onClose}
					className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
					aria-label="Close">
					<svg
						className="w-5 h-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2.5"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>

				<div className="text-center">
					<div className="w-16 h-16 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-orange-500/20 rotate-3">
						<span className="text-[10px] font-black uppercase tracking-widest text-black">
							Coffee
						</span>
					</div>

					<h2 className="text-xl font-black text-white mb-2 leading-tight">
						{t.donateHeader}
					</h2>

					<p className="text-slate-400 text-xs leading-relaxed mb-6 italic">
						"{t.donateJoke}"
					</p>

					<div className="relative bg-white p-3 rounded-2xl mb-6 shadow-inner group">
						<img
							src="/qr.jpg"
							alt="QR Code"
							className="w-full aspect-square object-contain rounded-lg"
						/>
						<div className="mt-2 text-[10px] font-black uppercase tracking-tighter text-slate-400 group-hover:text-pink-600 transition-colors">
							Scan to support
						</div>
					</div>

					<button
						onClick={onClose}
						className="w-full py-3 bg-white text-black text-xs font-black uppercase tracking-widest rounded-xl hover:bg-pink-500 hover:text-white transition-all active:scale-95 shadow-xl">
						{t.donateClose}
					</button>
				</div>
			</div>
		</div>
	);
};

export default DonateModal;
