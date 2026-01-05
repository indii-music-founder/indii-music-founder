/**
 * Usage Dashboard - Shows subscription usage statistics and quotas
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowUpRight, RefreshCw, Loader2 } from 'lucide-react';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import { UsageStats, UsageWarning, UsageWarningLevel } from '@/services/subscription/types';
import { SubscriptionTier } from '@/services/subscription/SubscriptionTier';

export const UsageDashboard: React.FC = () => {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [warnings, setWarnings] = useState<UsageWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUsageStats();
    loadWarnings();
  }, []);

  const loadUsageStats = async () => {
    try {
      const data = await subscriptionService.getCurrentUsageStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWarnings = async () => {
    try {
      const data = await subscriptionService.getUsageWarnings();
      setWarnings(data);
    } catch (error) {
      console.error('Failed to load warnings:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadUsageStats(),
      loadWarnings()
    ]);
    setRefreshing(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="bg-[#161b22] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin w-8 h-8 text-gray-400" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-[#161b22] rounded-xl p-6 border border-gray-800">
        <p className="text-gray-400 text-center">Failed to load usage statistics.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#161b22] rounded-xl p-6 border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">Usage This Period</h3>
          <p className="text-gray-400 text-sm">
            Resets: {formatDate(stats.resetDate)}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg hover:bg-gray-700 transition"
          title="Refresh"
        >
          <RefreshCw
            className={`w-5 h-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-6 space-y-2">
          {warnings.map((warning, index) => (
            <UsageWarningCard key={index} warning={warning} />
          ))}
        </div>
      )}

      {/* Usage Bars */}
      <div className="space-y-6">
        {/* Images */}
        <UsageBar
          label="Images Generated"
          used={stats.imagesGenerated}
          total={stats.imagesPerMonth}
          color="blue"
          unit="images"
        />

        {/* Video */}
        <UsageBar
          label="Video Duration"
          used={stats.videoDurationMinutes}
          total={stats.videoTotalMinutes}
          color="purple"
          unit="minutes"
        />

        {/* Chat Tokens */}
        <UsageBar
          label="AI Chat Tokens"
          used={stats.aiChatTokensUsed}
          total={stats.aiChatTokensPerMonth}
          color="yellow"
          unit="tokens"
          formatNumber={(v) => v.toLocaleString()}
        />

        {/* Storage */}
        <UsageBar
          label="Storage"
          used={stats.storageUsedGB}
          total={stats.storageTotalGB}
          color="green"
          unit="GB"
          formatNumber={(v) => v.toFixed(2)}
        />

        {/* Projects */}
        <UsageBar
          label="Projects"
          used={stats.projectsCreated}
          total={stats.maxProjects}
          color="orange"
          unit="projects"
        />
      </div>

      {/* Footer */}
      <div className="mt-6 pt-6 border-t border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">
            Current Plan: <span className="text-white font-medium">{stats.tier}</span>
          </span>
          {stats.tier !== SubscriptionTier.FREE && (
            <a
              href="/pricing"
              className="text-yellow-500 hover:text-yellow-400 flex items-center gap-1 transition"
            >
              Upgrade Plan
              <ArrowUpRight size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

interface UsageBarProps {
  label: string;
  used: number;
  total: number;
  color: 'blue' | 'purple' | 'yellow' | 'green' | 'orange';
  unit: string;
  formatNumber?: (value: number) => string | number;
}

const UsageBar: React.FC<UsageBarProps> = ({
  label,
  used,
  total,
  color,
  unit,
  formatNumber = (v) => v
}) => {
  const percentage = Math.min((used / total) * 100, 100);
  const isNearLimit = percentage >= 85;
  const isExceeded = percentage >= 100;

  const colors = {
    blue: {
      bg: 'bg-blue-500',
      text: 'text-blue-500',
      bgLight: 'bg-blue-500/10'
    },
    purple: {
      bg: 'bg-purple-500',
      text: 'text-purple-500',
      bgLight: 'bg-purple-500/10'
    },
    yellow: {
      bg: 'bg-yellow-500',
      text: 'text-yellow-500',
      bgLight: 'bg-yellow-500/10'
    },
    green: {
      bg: 'bg-green-500',
      text: 'text-green-500',
      bgLight: 'bg-green-500/10'
    },
    orange: {
      bg: 'bg-orange-500',
      text: 'text-orange-500',
      bgLight: 'bg-orange-500/10'
    }
  };

  const colorScheme = colors[color];

  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-300 flex items-center gap-2">
          {label}
          {isExceeded && (
            <AlertCircle className="w-4 h-4 text-red-500" size={14} />
          )}
        </span>
        <span
          className={`${isExceeded ? 'text-red-500' : 'text-gray-400'} font-medium`}
        >
          {formatNumber(used)}/{formatNumber(total)} {unit}
        </span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`h-full transition-colors ${
            isExceeded
              ? 'bg-red-500'
              : isNearLimit
              ? colorScheme.bg
              : colorScheme.bg + ' opacity-70'
          }`}
        />
      </div>
    </div>
  );
};

interface UsageWarningCardProps {
  warning: UsageWarning;
}

const UsageWarningCard: React.FC<UsageWarningCardProps> = ({ warning }) => {
  const bgColor =
    warning.level === UsageWarningLevel.EXCEEDED
      ? 'bg-red-500/20 border-red-500'
      : warning.level === UsageWarningLevel.CRITICAL
      ? 'bg-orange-500/20 border-orange-500'
      : 'bg-yellow-500/20 border-yellow-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`p-4 rounded-lg border flex items-start gap-3 ${bgColor} ${warning.dismissible ? 'cursor-pointer hover:opacity-80' : ''
      }`}
    >
      <AlertCircle
        className={`flex-shrink-0 mt-0.5 ${
          warning.level === UsageWarningLevel.EXCEEDED
            ? 'text-red-500'
            : 'text-orange-500'
        }`}
        size={18}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium">{warning.message}</p>
        {warning.upgradeUrl && (
          <a
            href={warning.upgradeUrl}
            className="text-sm text-white/80 hover:text-white underline mt-1 inline-block"
          >
            Upgrade your plan
          </a>
        )}
      </div>
    </motion.div>
  );
};
