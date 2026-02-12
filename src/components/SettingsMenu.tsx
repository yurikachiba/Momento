import { type FC } from 'react';
import { getLocalUserId, resetLocalUserId } from '../lib/api';

interface SettingsMenuProps {
  onClose: () => void;
  usage: { count: number; totalSize: number; limit: number } | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const SettingsMenu: FC<SettingsMenuProps> = ({ onClose, usage }) => {
  const userId = getLocalUserId();

  return (
    <div className="category-add-overlay" onClick={onClose}>
      <div
        className="category-add-dialog settings-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>設定</h3>

        {usage && (
          <div className="settings-section">
            <p className="settings-section-title">☁️ クラウドストレージ</p>
            <div className="storage-info">
              <span className="storage-size">
                {formatBytes(usage.totalSize)}
              </span>
              <span className="storage-count">
                / {formatBytes(usage.limit)}
              </span>
            </div>
            <div className="usage-bar-track" style={{ marginTop: '8px' }}>
              <div
                className="usage-bar-fill"
                style={{
                  width: `${Math.min(100, (usage.totalSize / usage.limit) * 100)}%`,
                }}
              />
            </div>
            <p className="storage-meta-text">
              写真 {usage.count}枚 クラウドに保存済み
            </p>
          </div>
        )}

        <div className="settings-section">
          <p className="settings-section-title">👤 ユーザーID</p>
          <div className="user-id-display">
            <code>
              {userId.slice(0, 8)}...{userId.slice(-4)}
            </code>
          </div>
          <p className="settings-hint">
            このIDで写真が管理されています。
            <br />
            ブラウザのデータを消すとアクセスできなくなります。
          </p>
          <button
            className="settings-btn"
            onClick={() => {
              if (
                confirm(
                  'ユーザーIDをリセットすると、保存済みの写真にアクセスできなくなります。\n本当にリセットしますか？'
                )
              ) {
                resetLocalUserId();
                window.location.reload();
              }
            }}
          >
            <span className="settings-btn-icon">🔄</span>
            <span className="settings-btn-text">
              <strong>IDをリセット</strong>
              <small>新しいユーザーとして使い直す</small>
            </span>
          </button>
        </div>

        <div className="settings-section">
          <p className="settings-section-title">ℹ️ アプリ情報</p>
          <p className="settings-hint">
            Momento Lite v1.0
            <br />
            写真はCloudinaryに安全に保存されます。
            <br />
            端末の容量は使用しません。
          </p>
        </div>

        <button className="btn-secondary settings-close" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
};

export default SettingsMenu;
