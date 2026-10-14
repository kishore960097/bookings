import React, { useState, useEffect } from 'react';
import { Salon, AnalyticsData } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  TrendingUp,
  DollarSign,
  Users,
  Clock,
  Download,
  Calendar,
  BarChart3,
  Star,
  CheckCircle2} from 'lucide-react';

interface AnalyticsViewProps {
  salon: Salon;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ salon }) => {
  const { t } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.getAnalytics(salon.id, period);
      if (res && res.analytics) {
        setData(res.analytics);
      }
    } catch (e) {
      console.error('Error fetching analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [salon.id, period]);

  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total Revenue', `INR ${data.totalRevenue}`],
      ['Total Completed Customers', `${data.totalBookings}`],
      ['Average Service Time', `${data.avgServiceTimeMinutes} mins`],
      ['No Show Rate', `${data.noShowRate}%`],
      [],
      ['Hour', 'Customer Volume'],
      ...data.hourlyTraffic.map((h) => [h.hour, `${h.count}`]),
      [],
      ['Top Service', 'Bookings Count', 'Revenue'],
      ...data.topServices.map((s) => [s.name, `${s.count}`, `INR ${s.revenue}`]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `QGo_Analytics_${salon.name.replace(/\s+/g, '_')}_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || !data) {
    return (
      <div className="p-12 text-center text-[rgba(23,23,23,0.70)] text-xs font-medium">
        Calculating business performance metrics...
      </div>
    );
  }

  const maxTraffic = Math.max(...data.hourlyTraffic.map((h) => h.count), 1);

  return (
    <div className="space-y-6">
      {/* Period & Export Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-[#FFFFFF] p-4 rounded-3xl border border-[rgba(23,23,23,0.12)] shadow-xs">
        <div className="flex bg-[#FFFFFF] p-1 rounded-2xl gap-1">
          <button
            onClick={() => setPeriod('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors duration-150 ${
              period === 'today' ? 'bg-[#FFFFFF] text-[#171717] shadow-xs' : 'text-[rgba(23,23,23,0.70)]'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors duration-150 ${
              period === 'week' ? 'bg-[#FFFFFF] text-[#171717] shadow-xs' : 'text-[rgba(23,23,23,0.70)]'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors duration-150 ${
              period === 'month' ? 'bg-[#FFFFFF] text-[#171717] shadow-xs' : 'text-[rgba(23,23,23,0.70)]'
            }`}
          >
            This Month
          </button>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-4 py-2 rounded-xl bg-[#FFFFFF] hover:bg-[rgba(23,23,23,0.05)] text-[#171717] font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)] shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-[rgba(23,23,23,0.70)] uppercase tracking-wider block">
            Total Revenue
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#171717]">
            {t.rupees}
            {data.totalRevenue.toLocaleString()}
          </div>
          <span className="text-[11px] text-[#FF9F1C] font-bold flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" />
            +18% from last cycle
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)] shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-[rgba(23,23,23,0.70)] uppercase tracking-wider block">
            Served Customers
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#171717]">
            {data.totalBookings}
          </div>
          <span className="text-[11px] text-[rgba(23,23,23,0.70)] font-medium">
            Walk-in + Online appointments
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)] shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-[rgba(23,23,23,0.70)] uppercase tracking-wider block">
            Avg Turn Time
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#FF9F1C]">
            {data.avgServiceTimeMinutes}m
          </div>
          <span className="text-[11px] text-[rgba(23,23,23,0.70)] font-medium">Per chair cycle</span>
        </div>

        <div className="p-5 rounded-3xl bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)] shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-[rgba(23,23,23,0.70)] uppercase tracking-wider block">
            No-Show Rate
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#FF9F1C]">
            {data.noShowRate}%
          </div>
          <span className="text-[11px] text-[#FF9F1C] font-bold">Low due to QR reminders</span>
        </div>
      </div>

      {/* Hourly Traffic Bar Chart */}
      <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(23,23,23,0.12)] shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base text-[#171717]">Hourly Footfall & Queue Peaks</h3>
            <span className="text-xs text-[rgba(23,23,23,0.70)]">Customer distribution throughout the day</span>
          </div>
          <BarChart3 className="w-5 h-5 text-[rgba(23,23,23,0.70)]" />
        </div>

        <div className="pt-6 pb-2">
          <div className="h-44 flex items-end justify-between gap-2">
            {data.hourlyTraffic.map((item) => {
              const heightPercent = (item.count / maxTraffic) * 100;
              return (
                <div key={item.hour} className="flex-1 flex flex-col items-center gap-2 group">
                  <span className="text-[11px] font-bold text-[rgba(23,23,23,0.70)] opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.count}
                  </span>
                  <div className="w-full max-w-[36px] bg-[#FFFFFF] rounded-t-xl overflow-hidden h-36 flex items-end">
                    <div
                      style={{ height: `${Math.max(heightPercent, 8)}%` }}
                      className="w-full bg-gradient-to-t from-[#FF9F1C] to-[#FF9F1C]/80 rounded-t-xl group-hover:from-[#FF9F1C] group-hover:to-[#FF9F1C]/80 transition-colors duration-150"
                    />
                  </div>
                  <span className="text-[11px] font-mono text-[rgba(23,23,23,0.70)]">{item.hour}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Services & Stylist Performance Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Services */}
        <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(23,23,23,0.12)] shadow-sm p-6 space-y-4">
          <h3 className="font-extrabold text-base text-[#171717]">Most Popular Services</h3>
          <div className="space-y-3">
            {data.topServices.map((srv, idx) => (
              <div
                key={srv.name}
                className="p-3.5 rounded-2xl bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)] flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-[#FFFFFF] text-[#171717] text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="font-bold text-xs text-[#171717]">{srv.name}</h4>
                    <span className="text-[11px] text-[rgba(23,23,23,0.70)]">{srv.count} served</span>
                  </div>
                </div>
                <span className="font-extrabold text-xs text-[#171717]">
                  {t.rupees}
                  {srv.revenue.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Staff Performance */}
        <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(23,23,23,0.12)] shadow-sm p-6 space-y-4">
          <h3 className="font-extrabold text-base text-[#171717]">Stylist Productivity</h3>
          <div className="space-y-3">
            {data.staffPerformance.map((st) => (
              <div
                key={st.name}
                className="p-3.5 rounded-2xl bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)] flex items-center justify-between"
              >
                <div>
                  <h4 className="font-bold text-xs text-[#171717]">{st.name}</h4>
                  <span className="text-[11px] text-[rgba(23,23,23,0.70)]">
                    {st.servedCount} clients • {st.avgMins}m avg pace
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#FF9F1C] bg-[rgba(255,159,28,0.15)] px-2 py-1 rounded-lg">
                  <Star className="w-3.5 h-3.5 fill-[#FF9F1C] text-[#FF9F1C]" />
                  <span>{st.rating}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
