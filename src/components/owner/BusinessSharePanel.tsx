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
      color: { dark: '#0A0A0A', light: '#ffffff' },
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
    <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(10,10,10,0.12)] p-5 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[rgba(231,50,41,0.08)] flex items-center justify-center">
          <Share2 className="w-4 h-4 text-[#C9281F]" />
        </div>
        <div>
          <h3 className="text-sm font-black text-[#0A0A0A]">Share Your Business</h3>
          <p className="text-[11px] text-[rgba(10,10,10,0.70)]">Let customers find and book you on QGo</p>
        </div>
      </div>

      {/* Booking URL */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-black uppercase tracking-wider text-[rgba(10,10,10,0.70)]">
          Your Booking Link
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-[#FFFFFF] border border-[rgba(10,10,10,0.12)] rounded-xl px-3 py-2.5 text-xs font-mono text-[rgba(10,10,10,0.70)] truncate">
            {bookingUrl}
          </div>
          <button
            onClick={handleCopy}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors duration-150 shrink-0 ${
              copied
                ? 'bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF]'
                : 'bg-[#FFFFFF] hover:bg-[rgba(10,10,10,0.05)] text-[#0A0A0A]'
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
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] text-xs font-bold transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Share on WhatsApp
        </button>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[rgba(10,10,10,0.05)] text-[rgba(10,10,10,0.70)] text-xs font-bold transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Preview Page
        </a>
      </div>

      {/* QR Code */}
      <div className="border-t border-[rgba(10,10,10,0.12)] pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-black text-[#0A0A0A]">QR Code</h4>
            <p className="text-[11px] text-[rgba(10,10,10,0.70)]">
              Print and place at your shop — customers scan to book
            </p>
          </div>
          <button
            onClick={handleDownloadQr}
            disabled={!qrDataUrl}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#E73229] hover:bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] text-xs font-bold transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Download QR
          </button>
        </div>

        {/* QR Preview Card */}
        <div className="max-w-xs mx-auto bg-[#FFFFFF] rounded-2xl p-6 text-center space-y-3 border-2 border-[#E73229]">
          <div className="text-[11px] font-black uppercase tracking-widest text-[#C9281F]">
            QGo — Scan to Book
          </div>
          <h3 className="text-sm font-black text-[#0A0A0A] leading-tight">{salon.name}</h3>
          <div className="bg-[#FFFFFF] rounded-xl p-3 inline-block mx-auto">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Booking QR" className="w-40 h-40 mx-auto" />
            ) : (
              <div className="w-40 h-40 bg-[#FFFFFF] rounded-lg flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[rgba(10,10,10,0.12)] border-t-indigo-500 rounded-full animate-spin" />
              </div>
            )}
          </div>
          <p className="text-[11px] text-[rgba(10,10,10,0.70)]">
            Scan with phone camera to book an appointment
          </p>
        </div>
      </div>
    </div>
  );
};
