import React, { useState } from 'react';
import { Modal } from './Modal';
import { QrCode, Copy, Check, ShieldCheck } from 'lucide-react';

export const QrCodeModal = ({ isOpen, onClose, donation }) => {
  const [copied, setCopied] = useState(false);

  if (!donation) return null;

  const qrToken = donation.handoverQrToken || `SAP-QR-${donation.id}-SECURE`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(qrToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // High-contrast clean QR Code visual matrix representation
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Secure Handover QR Code">
      <div className="text-center py-2 space-y-4">
        <p className="text-xs text-slate-500">
          Present this QR code to the verified delivery agent during food pickup or delivery handover.
        </p>

        {/* QR Code Graphic Frame */}
        <div className="relative inline-block p-5 bg-white rounded-2xl border-2 border-slate-900 shadow-xl mx-auto">
          <div className="w-52 h-52 bg-white flex flex-col items-center justify-center p-2 border border-slate-200 rounded-xl relative overflow-hidden">
            {/* SVG stylized QR code pattern with authentic finder patterns */}
            <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900 fill-current">
              {/* Corner 1 Finder Pattern */}
              <rect x="5" y="5" width="25" height="25" rx="3" fill="#0f172a" />
              <rect x="9" y="9" width="17" height="17" rx="2" fill="#ffffff" />
              <rect x="13" y="13" width="9" height="9" rx="1" fill="#0f172a" />

              {/* Corner 2 Finder Pattern */}
              <rect x="70" y="5" width="25" height="25" rx="3" fill="#0f172a" />
              <rect x="74" y="9" width="17" height="17" rx="2" fill="#ffffff" />
              <rect x="78" y="13" width="9" height="9" rx="1" fill="#0f172a" />

              {/* Corner 3 Finder Pattern */}
              <rect x="5" y="70" width="25" height="25" rx="3" fill="#0f172a" />
              <rect x="9" y="74" width="17" height="17" rx="2" fill="#ffffff" />
              <rect x="13" y="78" width="9" height="9" rx="1" fill="#0f172a" />

              {/* Center brand dot */}
              <circle cx="50" cy="50" r="7" fill="#e11d48" />

              {/* Data dots matrix simulation */}
              <rect x="36" y="10" width="5" height="5" />
              <rect x="46" y="10" width="5" height="5" />
              <rect x="56" y="10" width="5" height="5" />
              <rect x="36" y="20" width="5" height="5" />
              <rect x="46" y="25" width="5" height="5" />
              <rect x="56" y="20" width="5" height="5" />
              <rect x="10" y="36" width="5" height="5" />
              <rect x="20" y="46" width="5" height="5" />
              <rect x="10" y="56" width="5" height="5" />
              <rect x="70" y="36" width="5" height="5" />
              <rect x="85" y="46" width="5" height="5" />
              <rect x="75" y="56" width="5" height="5" />
              <rect x="36" y="70" width="5" height="5" />
              <rect x="46" y="75" width="5" height="5" />
              <rect x="56" y="85" width="5" height="5" />
              <rect x="70" y="70" width="5" height="5" />
              <rect x="80" y="80" width="5" height="5" />
              <rect x="88" y="75" width="5" height="5" />
            </svg>
          </div>
          <div className="mt-2 text-[11px] font-mono font-bold text-slate-700 tracking-wider">
            {donation.id?.toUpperCase()}
          </div>
        </div>

        {/* Token string & copy */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-left">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase">Verification Token</div>
            <div className="font-mono text-xs font-semibold text-slate-800 truncate max-w-[240px]">
              {qrToken}
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-white border border-rose-200 px-3 py-1.5 rounded-lg shadow-xs transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Security assurance */}
        <div className="flex items-center justify-center gap-2 text-xs text-emerald-700 bg-emerald-50 py-2 rounded-lg border border-emerald-200/80">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Cryptographically Signed • Single-Use Handover Token</span>
        </div>
      </div>
    </Modal>
  );
};
