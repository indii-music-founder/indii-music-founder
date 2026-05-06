import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Radio, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  RefreshCcw,
  BarChart3
} from 'lucide-react';
import { revenueService, type RevenueStats } from '@/services/RevenueService';
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import { motion, AnimatePresence } from 'framer-motion';

const StatCard = ({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  color 
}: { 
  title: string; 
  value: string; 
  change: number; 
  icon: any; 
  color: string;
}) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-[#161b22] border border-gray-800 rounded-2xl p-6 relative overflow-hidden group"
  >
    <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 opacity-10 blur-2xl rounded-full ${color}`} />
    
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl bg-gray-900/50 border border-gray-800 ${color.replace('bg-', 'text-')}`}>
        <Icon size={24} />
      </div>
      <div className={`flex items-center gap-1 text-sm font-medium ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        {Math.abs(change).toFixed(1)}%
      </div>
    </div>
    
    <h3 className="text-gray-400 text-sm font-medium mb-1" data-testid={`revenue-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>{title}</h3>
    <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
  </motion.div>
);

const SourceBreakdown = ({ sources, counts }: { sources: any, counts: any }) => {
  const total = Object.values(sources).reduce((a: any, b: any) => a + b, 0) as number;
  
  const sourceIcons: Record<string, any> = {
    streaming: Radio,
    merch: ShoppingBag,
    licensing: DollarSign,
    social: TrendingUp
  };

  const sourceColors: Record<string, string> = {
    streaming: 'bg-blue-500',
    merch: 'bg-purple-500',
    licensing: 'bg-emerald-500',
    social: 'bg-pink-500'
  };

  return (
    <div className="space-y-4">
      {Object.entries(sources).map(([key, value]: [string, any]) => {
        const percentage = total > 0 ? (value / total) * 100 : 0;
        const Icon = sourceIcons[key] || DollarSign;
        const color = sourceColors[key] || 'bg-gray-500';
        
        return (
          <div key={key} className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2 text-gray-300 capitalize">
                <Icon size={14} className={color.replace('bg-', 'text-')} />
                {key}
              </div>
              <div className="text-white font-medium">
                ${value.toLocaleString()} <span className="text-gray-500 text-xs ml-1">({counts[key] || 0})</span>
              </div>
            </div>
            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                className={`h-full ${color}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const RevenueView: React.FC = () => {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'30d' | '90d' | '12y' | 'all'>('30d');

  const fetchStats = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      
      setLoading(true);
      const data = await revenueService.getUserRevenueStats(userId, period);
      setStats(data);
    } catch (error) {
      logger.error('[RevenueView] Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [period]);

  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-gray-800/50 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white" data-testid="revenue-overview-title">Revenue Overview</h2>
          <p className="text-gray-400 text-sm mt-1">Real-time aggregation from streaming, merch, and social sales.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#161b22] border border-gray-800 rounded-lg p-1">
            {(['30d', '90d', 'all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                data-testid={`revenue-period-${p}`}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === p 
                    ? 'bg-purple-600 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
          <button 
            onClick={fetchStats}
            className="p-2 bg-[#161b22] border border-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Revenue" 
          value={`$${stats.totalRevenue.toLocaleString()}`}
          change={stats.revenueChange}
          icon={DollarSign}
          color="bg-purple-500"
        />
        <StatCard 
          title="Units Sold" 
          value={stats.unitsSold.toLocaleString()}
          change={stats.unitsChange}
          icon={ShoppingBag}
          color="bg-blue-500"
        />
        <StatCard 
          title="Streaming" 
          value={`$${stats.sources.streaming.toLocaleString()}`}
          change={0} // Fixed comparison needed for sub-metrics
          icon={Radio}
          color="bg-emerald-500"
        />
        <StatCard 
          title="Social Drops" 
          value={`$${stats.sources.social.toLocaleString()}`}
          change={0}
          icon={TrendingUp}
          color="bg-pink-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#161b22] border border-gray-800 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 size={20} className="text-purple-500" />
              Revenue History
            </h3>
          </div>
          
          <div className="h-64 flex items-end gap-2 px-2">
            {stats.history.length > 0 ? (
              stats.history.slice(-20).map((h, i) => {
                const max = Math.max(...stats.history.map(item => item.amount));
                const height = max > 0 ? (h.amount / max) * 100 : 0;
                
                return (
                  <div key={i} className="flex-1 group relative">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      className="bg-purple-500/20 group-hover:bg-purple-500/40 rounded-t-sm transition-colors border-t border-purple-500/50"
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 border border-gray-700 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-2xl">
                      {h.date}: ${h.amount.toLocaleString()}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 italic text-sm">
                No history data available for this period.
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-between text-[10px] text-gray-500 uppercase font-bold tracking-widest">
            <span>Start of Period</span>
            <span>Current Date</span>
          </div>
        </div>

        <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Filter size={20} className="text-blue-500" />
            Source Breakdown
          </h3>
          <SourceBreakdown sources={stats.sources} counts={stats.sourceCounts} />
          
          <div className="mt-8 p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-widest">Top Product</h4>
            {(() => {
              const productEntries = Object.entries(stats.revenueByProduct || {}).sort((a, b) => b[1] - a[1]);
              const topProduct = productEntries[0];
              if (!topProduct) return <span className="text-gray-500 text-sm italic">No product data</span>;
              
              const [productId, amount] = topProduct;
              
              return (
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium truncate max-w-[150px]">
                    {productId}
                  </span>
                  <span className="text-purple-400 font-bold">
                    ${amount.toLocaleString()}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueView;
