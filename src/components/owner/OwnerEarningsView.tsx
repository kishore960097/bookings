import React, { useState, useEffect } from 'react';
import { Salon, OwnerRevenueData } from '../../types';
import { api } from '../../services/api';
import {
  DollarSign,
  TrendingUp,
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';

interface OwnerEarningsViewProps {
  salon: Salon;
}

export const OwnerEarningsView: React.FC<OwnerEarningsViewProps> = ({ salon }) => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [revenueData, setRevenueData] = useState<OwnerRevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRevenue = async () => {
    setLoading(true);
    try {
      const res = await api.getSalonRevenueStats(salon.id, { period });
      if (res && res.data) {
        setRevenueData(res.data);
      }
    } catch (e) {
      console.error('Error fetching revenue stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenue();
  }, [salon.id, period]);

  const handleExportCsv = () => {
    if (!revenueData || !revenueData.transactions) return;
    let csv = 'BookingID,TokenNumber,CustomerName,Phone,Service,Amount,RefundAmount,Status,PaymentStatus,Date,Created\n';
    revenueData.transactions.forEach((t) => {
      csv += `"${t.bookingId}","${t.tokenNumber || ''}","${t.customerName}","${t.customerPhone}","${t.serviceName}",${t.amount},${t.refundAmount || 0},"${t.status}","${t.paymentStatus}","${t.scheduledDate || ''}","${t.createdAt}"\n`;
    });

    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `QGo_Revenue_${salon.name.replace(/\s+/g, '_')}_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* ── 1. HEADER & PERIOD SELECTOR ── */}
      <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(23,23,23,0.12)] p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-[#171717]">Revenue &amp; Earnings</h2>
          <p className="text-xs text-[rgba(23,23,23,0.70)] mt-0.5">Real-time accounting of bookings, refunds, and net payout</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
          <div className="bg-[#FFFFFF] p-1 rounded-xl flex flex-wrap items-center gap-1">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'all', label: 'All Time' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors duration-150 ${
                  period === p.id ? 'bg-[#FFFFFF] text-[#171717] shadow-2xs' : 'text-[rgba(23,23,23,0.70)] hover:text-[#171717]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-[#FFFFFF] hover:bg-[rgba(23,23,23,0.05)] text-[#171717] font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── 2. REVENUE METRICS CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Net Revenue */}
        <div className="bg-gradient-to-br from-[#FF9F1C] to-[#FF9F1C]/80 text-[#171717] rounded-3xl p-5 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#FF9F1C]">Net Revenue</span>
            <TrendingUp className="w-5 h-5 text-[#FF9F1C]" />
          </div>
          <div className="mt-4">
            <span className="text-3xl sm:text-4xl font-black font-mono">
              ₹{(revenueData?.netRevenue || 0).toLocaleString()}
            </span>
            <p className="text-xs text-[#FF9F1C] mt-1 font-medium">
              Gross bookings minus customer cancellation refunds
            </p>
          </div>
        </div>

        {/* Gross Revenue */}
        <div className="bg-[#FFFFFF] rounded-3xl p-5 border border-[rgba(23,23,23,0.12)] shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] flex items-center justify-center mb-2">
            <DollarSign className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider text-[rgba(23,23,23,0.70)] block">Gross Bookings</span>
          <span className="text-2xl font-black text-[#171717] mt-1 block font-mono">
            ₹{(revenueData?.grossRevenue || 0).toLocaleString()}
          </span>
        </div>

        {/* Completed Bookings */}
        <div className="bg-[#FFFFFF] rounded-3xl p-5 border border-[rgba(23,23,23,0.12)] shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] flex items-center justify-center mb-2">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider text-[rgba(23,23,23,0.70)] block">Completed Bookings</span>
          <span className="text-2xl font-black text-[#171717] mt-1 block">
            {revenueData?.completedBookingsCount || 0}
          </span>
        </div>

        {/* Refunds */}
        <div className="bg-[#FFFFFF] rounded-3xl p-5 border border-[rgba(23,23,23,0.12)] bg-[rgba(255,159,28,0.15)] shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] flex items-center justify-center mb-2">
            <RotateCcw className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider text-[#FF9F1C] block">Refunds Processed</span>
          <span className="text-2xl font-black text-[#FF9F1C] mt-1 block font-mono">
            ₹{(revenueData?.totalRefunds || 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── 3. TRANSACTION HISTORY ── */}
      <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(23,23,23,0.12)] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[rgba(23,23,23,0.12)]">
          <div>
            <h3 className="font-black text-base text-[#171717]">Transaction History</h3>
            <p className="text-xs text-[rgba(23,23,23,0.70)] mt-0.5">Itemized record of all bookings and cancellations</p>
          </div>
          <span className="text-xs font-bold text-[rgba(23,23,23,0.70)]">
            {revenueData?.transactions?.length || 0} Transactions
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[rgba(23,23,23,0.70)]">
            <div className="w-8 h-8 border-3 border-[rgba(23,23,23,0.12)] border-t-emerald-600 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold">Loading transactions...</p>
          </div>
        ) : !revenueData?.transactions || revenueData.transactions.length === 0 ? (
          <div className="py-12 text-center text-[rgba(23,23,23,0.70)] space-y-2">
            <DollarSign className="w-10 h-10 mx-auto text-[rgba(23,23,23,0.70)] stroke-1" />
            <p className="text-sm font-bold text-[rgba(23,23,23,0.70)]">No transactions recorded for this period</p>
            <p className="text-xs text-[rgba(23,23,23,0.70)]">
              Transactions will automatically populate as customers make bookings.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[rgba(23,23,23,0.12)] text-[11px] font-black uppercase tracking-wider text-[rgba(23,23,23,0.70)] bg-[rgba(23,23,23,0.05)]">
                  <th className="py-3 px-3.5">Booking / ID</th>
                  <th className="py-3 px-3.5">Customer</th>
                  <th className="py-3 px-3.5">Slot Date &amp; Time</th>
                  <th className="py-3 px-3.5 text-right">Amount</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5 text-right">Refund</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {revenueData.transactions.map((t) => {
                  const isCancelled = t.status === 'cancelled';
                  const isCompleted = t.status === 'completed';
                  const shortId = `QGO-${t.bookingId.split('_').pop()?.toUpperCase()}`;

                  return (
                    <tr key={t.bookingId} className="hover:bg-[rgba(23,23,23,0.05)] transition-colors">
                      <td className="py-3.5 px-3.5 font-bold text-[#171717] font-mono">
                        <span className="text-[#FF9F1C]">{shortId}</span>
                      </td>

                      <td className="py-3.5 px-3.5 text-[#171717]">
                        <div className="font-bold">{t.customerName}</div>
                        <div className="text-[11px] text-[rgba(23,23,23,0.70)] font-mono">{t.customerPhone}</div>
                      </td>

                      <td className="py-3.5 px-3.5 text-[rgba(23,23,23,0.70)] font-mono">
                        {t.scheduledDate || 'Today'} {t.scheduledTime ? `· ${t.scheduledTime}` : ''}
                      </td>

                      <td className="py-3.5 px-3.5 text-right font-black text-[#171717] font-mono">
                        ₹{t.amount}
                      </td>

                      <td className="py-3.5 px-3.5 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider ${
                            isCompleted
                              ? 'bg-[rgba(255,159,28,0.15)] text-[#FF9F1C]'
                              : isCancelled
                              ? 'bg-[rgba(255,159,28,0.15)] text-[#FF9F1C]'
                              : 'bg-[rgba(255,159,28,0.15)] text-[#FF9F1C]'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-3.5 text-right font-mono font-bold">
                        {t.refundAmount ? (
                          <span className="text-[#FF9F1C]">-₹{t.refundAmount}</span>
                        ) : (
                          <span className="text-[rgba(23,23,23,0.70)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
