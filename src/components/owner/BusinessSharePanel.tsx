import React, { useState, useEffect } from 'react';
import { Salon } from '../../types';
import QRCode from 'qrcode';
import {
  Share2,
  Copy,
  Check,
  Download,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';

interface BusinessSharePanelProps {
  salon: Salon;
}

export const BusinessSharePanel: React.FC<BusinessSharePanelProps> = ({ salon }) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const bookingUrl = `${window.location.origin}/?businessId=${salon.id}`;
  const shareText = `Book at ${salon.name} on QGo: ${bookingUrl}`;

  useEffect(() => {
    QRCode.toDataURL(bookingUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [bookingUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'noopener');
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${salon.name.replace(/\s+/g, '-')}-QGo-QR.png`;
    a.click();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
          <Share2 className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-900">Share Your Business</h3>
          <p className="text-[11px] text-slate-500">Let customers find and book you on QGo</p>
        </div>
      </div>

      {/* Booking URL */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Your Booking Link
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-700 truncate">
            {bookingUrl}
          </div>
          <button
            onClick={handleCopy}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
              copied
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-900 hover:bg-slate-700 text-white'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Share Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleWhatsApp}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-xs font-bold transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Share on WhatsApp
        </button>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Preview Page
        </a>
      </div>

      {/* QR Code */}
      <div className="border-t border-slate-100 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-black text-slate-800">QR Code</h4>
            <p className="text-[11px] text-slate-500">
              Print and place at your shop — customers scan to book
            </p>
          </div>
          <button
            onClick={handleDownloadQr}
            disabled={!qrDataUrl}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Download QR
          </button>
        </div>

        {/* QR Preview Card */}
        <div className="max-w-xs mx-auto bg-slate-900 rounded-2xl p-6 text-center space-y-3 border-2 border-indigo-500/30">
          <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
            QGo — Scan to Book
          </div>
          <h3 className="text-sm font-black text-white leading-tight">{salon.name}</h3>
          <div className="bg-white rounded-xl p-3 inline-block mx-auto">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Booking QR" className="w-40 h-40 mx-auto" />
            ) : (
              <div className="w-40 h-40 bg-slate-100 rounded-lg flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            Scan with phone camera to book an appointment
          </p>
        </div>
      </div>
    </div>
  );
};
