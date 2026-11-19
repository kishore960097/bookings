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
    const safe = (value: unknown) => {
      const text = String(value ?? '').replaceAll('"', '""');
      return `"${/^[=+\-@\t\r]/.test(text) ? `'${text}` : text}"`;
    };
    let csv = 'BookingID,TokenNumber,CustomerName,Phone,Service,Amount,RefundAmount,Status,PaymentStatus,Date,Created\n';
    revenueData.transactions.forEach((t) => {
      csv += `${safe(t.bookingId)},${safe(t.tokenNumber || '')},${safe(t.customerName)},${safe(t.customerPhone)},${safe(t.serviceName)},${Number(t.amount) || 0},${Number(t.refundAmount) || 0},${safe(t.status)},${safe(t.paymentStatus)},${safe(t.scheduledDate || '')},${safe(t.createdAt)}\n`;
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
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* ── 1. HEADER & PERIOD SELECTOR ── */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(10,10,10,0.12)] p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-[#0A0A0A]">Revenue &amp; Earnings</h2>
          <p className="text-[11px] text-[rgba(10,10,10,0.70)] mt-0.5">Real-time accounting of bookings, refunds, and net payout</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-1 sm:mt-0 w-full sm:w-auto">
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
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors duration-150 min-h-[36px] ${
                  period === p.id ? 'bg-[#FFFFFF] text-[#0A0A0A] shadow-2xs' : 'text-[rgba(10,10,10,0.70)] hover:text-[#0A0A0A]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[rgba(10,10,10,0.05)] text-[#0A0A0A] font-semibold text-[13px] flex items-center gap-1.5 shadow-2xs transition-colors min-h-[36px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── 2. REVENUE METRICS CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {/* Net Revenue */}
        <div className="bg-[linear-gradient(135deg,#F0554A_0%,#E73229_100%)] text-[#0A0A0A] rounded-2xl p-3 sm:p-4 shadow-sm lg:col-span-2 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFFFFF]/90">Net Revenue</span>
            <TrendingUp className="w-4 h-4 text-[#FFFFFF]" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-[#FFFFFF]">
              ₹{(revenueData?.netRevenue || 0).toLocaleString()}
            </span>
            <p className="text-[11px] text-[#FFFFFF]/80 mt-0.5 font-medium">
              Gross bookings minus customer cancellation refunds
            </p>
          </div>
        </div>

        {/* Gross Revenue */}
        <div className="bg-[#FFFFFF] rounded-2xl p-3 sm:p-4 border border-[rgba(10,10,10,0.12)] shadow-2xs min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[rgba(231,50,41,0.08)] text-[#C9281F] flex items-center justify-center mb-1.5">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] block truncate">Gross Bookings</span>
          <span className="text-[18px] font-bold text-[#0A0A0A] mt-0.5 block font-mono">
            ₹{(revenueData?.grossRevenue || 0).toLocaleString()}
          </span>
        </div>

        {/* Completed Bookings */}
        <div className="bg-[#FFFFFF] rounded-2xl p-3 sm:p-4 border border-[rgba(10,10,10,0.12)] shadow-2xs min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[rgba(231,50,41,0.08)] text-[#C9281F] flex items-center justify-center mb-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] block truncate">Completed Bookings</span>
          <span className="text-[18px] font-bold text-[#0A0A0A] mt-0.5 block">
            {revenueData?.completedBookingsCount || 0}
          </span>
        </div>

        {/* Refunds */}
        <div className="bg-[#FFFFFF] rounded-2xl p-3 sm:p-4 border border-[rgba(10,10,10,0.12)] bg-[rgba(231,50,41,0.08)] shadow-2xs min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[rgba(231,50,41,0.08)] text-[#C9281F] flex items-center justify-center mb-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#C9281F] block truncate">Refunds Processed</span>
          <span className="text-[18px] font-bold text-[#C9281F] mt-0.5 block font-mono">
            ₹{(revenueData?.totalRefunds || 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── 3. TRANSACTION HISTORY ── */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(10,10,10,0.12)] p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-[rgba(10,10,10,0.12)]">
          <div>
            <h3 className="font-bold text-[15px] text-[#0A0A0A]">Transaction History</h3>
            <p className="text-[11px] text-[rgba(10,10,10,0.70)] mt-0.5">Itemized record of all bookings and cancellations</p>
          </div>
          <span className="text-[11px] font-semibold text-[rgba(10,10,10,0.70)]">
            {revenueData?.transactions?.length || 0} Transactions
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-[rgba(10,10,10,0.70)]">
            <div className="w-7 h-7 border-2 border-[rgba(10,10,10,0.12)] border-t-emerald-600 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold">Loading transactions...</p>
          </div>
        ) : !revenueData?.transactions || revenueData.transactions.length === 0 ? (
          <div className="py-8 text-center text-[rgba(10,10,10,0.70)] space-y-2">
            <DollarSign className="w-8 h-8 mx-auto text-[rgba(10,10,10,0.70)] stroke-1" />
            <p className="text-sm font-bold text-[rgba(10,10,10,0.70)]">No transactions recorded for this period</p>
            <p className="text-xs text-[rgba(10,10,10,0.70)]">
              Transactions will automatically populate as customers make bookings.
            </p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[rgba(10,10,10,0.12)] text-[10px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] bg-[rgba(10,10,10,0.05)]">
                    <th className="py-2.5 px-3">Booking / ID</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Slot Date &amp; Time</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Refund</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {revenueData.transactions.map((t) => {
                    const isCancelled = t.status === 'cancelled';
                    const isCompleted = t.status === 'completed';
                    const shortId = `QGO-${t.bookingId.split('_').pop()?.toUpperCase()}`;

                    return (
                      <tr key={t.bookingId} className="hover:bg-[rgba(10,10,10,0.05)] transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[#0A0A0A] font-mono text-[11px]">
                          <span className="text-[#C9281F]">{shortId}</span>
                        </td>

                        <td className="py-2.5 px-3 text-[#0A0A0A]">
                          <div className="font-semibold text-[13px]">{t.customerName}</div>
                          <div className="text-[10px] text-[rgba(10,10,10,0.70)] font-mono">{t.customerPhone}</div>
                        </td>

                        <td className="py-2.5 px-3 text-[rgba(10,10,10,0.70)] font-mono text-[11px]">
                          {t.scheduledDate || 'Today'} {t.scheduledTime ? `· ${t.scheduledTime}` : ''}
                        </td>

                        <td className="py-2.5 px-3 text-right font-bold text-[#0A0A0A] font-mono text-[13px]">
                          ₹{t.amount}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isCompleted
                                ? 'bg-[rgba(231,50,41,0.08)] text-[#C9281F]'
                                : isCancelled
                                ? 'bg-[rgba(231,50,41,0.08)] text-[#C9281F]'
                                : 'bg-[rgba(231,50,41,0.08)] text-[#C9281F]'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-[11px]">
                          {t.refundAmount ? (
                            <span className="text-[#C9281F]">-₹{t.refundAmount}</span>
                          ) : (
                            <span className="text-[rgba(10,10,10,0.70)]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards Layout */}
            <div className="md:hidden space-y-2">
              {revenueData.transactions.map((t) => {
                const isCancelled = t.status === 'cancelled';
                const isCompleted = t.status === 'completed';
                const shortId = `QGO-${t.bookingId.split('_').pop()?.toUpperCase()}`;

                return (
                  <div
                    key={t.bookingId}
                    className="p-3 rounded-xl border border-[rgba(10,10,10,0.12)] bg-[#FFFFFF] space-y-2 min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-[11px] font-mono font-bold text-[#C9281F]">
                        {shortId}
                      </span>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isCompleted
                            ? 'bg-[rgba(231,50,41,0.08)] text-[#C9281F]'
                            : isCancelled
                            ? 'bg-[rgba(231,50,41,0.08)] text-[#C9281F]'
                            : 'bg-[rgba(231,50,41,0.08)] text-[#C9281F]'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <div className="font-semibold text-[13px] text-[#0A0A0A] truncate">{t.customerName}</div>
                        <div className="text-[10px] text-[rgba(10,10,10,0.70)] font-mono">{t.customerPhone}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-[14px] text-[#0A0A0A] font-mono">₹{t.amount}</div>
                        {t.refundAmount ? (
                          <div className="text-[10px] text-[#C9281F] font-mono font-semibold">-₹{t.refundAmount}</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-[10px] text-[rgba(10,10,10,0.70)] font-mono pt-1.5 border-t border-[rgba(10,10,10,0.08)]">
                      {t.scheduledDate || 'Today'} {t.scheduledTime ? `· ${t.scheduledTime}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
