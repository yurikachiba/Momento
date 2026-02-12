import { type FC } from 'react';

interface UsageBarProps {
  usage: { count: number; totalSize: number; limit: number };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const UsageBar: FC<UsageBarProps> = ({ usage }) => {
  const percent = Math.min(100, (usage.totalSize / usage.limit) * 100);

  return (
    <div className="usage-bar">
      <div className="usage-bar-info">
        <span className="usage-bar-label">
          {formatBytes(usage.totalSize)} / {formatBytes(usage.limit)}
        </span>
        <span className="usage-bar-count">{usage.count}枚</span>
      </div>
      <div className="usage-bar-track">
        <div className="usage-bar-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

export default UsageBar;
