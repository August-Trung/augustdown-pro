import React from "react";

interface NavbarProps {
	lang: "en" | "vi";
	setLang: (l: "en" | "vi") => void;
	onDonateClick: () => void;
	onHomeClick: () => void;
	t: any;
}

const Navbar: React.FC<NavbarProps> = ({
	lang,
	setLang,
	onDonateClick,
	onHomeClick,
	t,
}) => {
	return (
		<nav className="fixed top-0 left-0 right-0 z-[100] glass-morphism border-b border-white/5 h-12">
			<div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
				<div
					onClick={onHomeClick}
					className="flex items-center gap-2 group cursor-pointer active:scale-95 transition-transform">
					<img
						src="/ver-bigger-logo.png"
						alt="Logo"
						className="w-4 h-4 object-contain"
					/>
					<span className="text-base font-black tracking-tighter text-white">
						AugustDown <span className="text-rose-500">Pro</span>
					</span>
				</div>

				<div className="flex items-center gap-4">
					<div className="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/10">
						<button
							onClick={() => setLang("en")}
							className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
								lang === "en"
									? "bg-white text-black"
									: "text-slate-500 hover:text-slate-300"
							}`}>
							EN
						</button>
						<button
							onClick={() => setLang("vi")}
							className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
								lang === "vi"
									? "bg-white text-black"
									: "text-slate-500 hover:text-slate-300"
							}`}>
							VI
						</button>
					</div>
					<button
						onClick={onDonateClick}
						className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors">
						{t.navDonate}
					</button>
				</div>
			</div>
		</nav>
	);
};

export default Navbar;
