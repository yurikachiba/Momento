import { type FC, useRef, useState, useEffect } from 'react';
import { exportData, importData } from '../lib/sync';
import { isEncryptionEnabled } from '../lib/crypto';
import { recompressAllPhotos, estimateStorageUsage } from '../lib/db';
import { getStorageMode, setStorageMode, type StorageMode } from '../lib/image';
import { isPersisted, markBackupDone, formatLastBackup } from '../lib/storage';
import {
  isFileSystemAccessSupported,
  isAutoBackupEnabled,
  setupAutoBackup,
  disableAutoBackup,
  performAutoBackup,
} from '../lib/autobackup';

interface SettingsMenuProps {
  onClose: () => void;
  onDataChanged: () => void;
  onSetupEncryption: () => void;
  onRemoveEncryption: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const SettingsMenu: FC<SettingsMenuProps> = ({
  onClose,
  onDataChanged,
  onSetupEncryption,
  onRemoveEncryption,
}) => {
  const importRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [storageMode, setMode] = useState<StorageMode>(getStorageMode);
  const [storageInfo, setStorageInfo] = useState<{ totalBytes: number; photoCount: number } | null>(null);

  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [autoBackupOn, setAutoBackupOn] = useState<boolean | null>(null);
  const fsSupported = isFileSystemAccessSupported();

  const encrypted = isEncryptionEnabled();

  useEffect(() => {
    estimateStorageUsage().then(setStorageInfo);
    isPersisted().then(setPersisted);
    isAutoBackupEnabled().then(setAutoBackupOn);
  }, []);

  const handleExport = async () => {
    setBusy(true);
    setStatus('エクスポート準備中...');
    try {
      await exportData((done, total) => {
        setStatus(`写真を圧縮中... ${done}/${total}`);
      });
      markBackupDone();
      setStatus('ダウンロードが始まりました');
      setTimeout(() => setStatus(null), 2000);
    } catch {
      setStatus('エクスポートに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file: File) => {
    setBusy(true);
    setStatus('ZIPを読み込み中...');
    try {
      const result = await importData(file, (done, total) => {
        setStatus(`写真を復元中... ${done}/${total}`);
      });
      const parts = [`写真${result.photosImported}枚`];
      if (result.albumsImported) parts.push(`アルバム${result.albumsImported}個`);
      setStatus(`完了！ ${parts.join('、')}を追加しました`);
      onDataChanged();
      estimateStorageUsage().then(setStorageInfo);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'インポートに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleStorageModeChange = (mode: StorageMode) => {
    setStorageMode(mode);
    setMode(mode);
  };

  const handleRecompress = async () => {
    if (!confirm('全写真を現在のモードで再圧縮します。\n画質が変わり、元には戻せません。続けますか？')) return;
    setBusy(true);
    setStatus('再圧縮中...');
    try {
      const count = await recompressAllPhotos((done, total) => {
        setStatus(`再圧縮中... ${done}/${total}`);
      });
      setStatus(`${count}枚の写真を再圧縮しました`);
      onDataChanged();
      const info = await estimateStorageUsage();
      setStorageInfo(info);
    } catch {
      setStatus('再圧縮に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="category-add-overlay" onClick={onClose}>
      <div className="category-add-dialog settings-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>データ管理</h3>

        {/* Storage Info */}
        {storageInfo && (
          <div className="settings-section">
            <p className="settings-section-title">📊 ストレージ使用量</p>
            <div className="storage-info">
              <span className="storage-size">{formatBytes(storageInfo.totalBytes)}</span>
              <span className="storage-count">（{storageInfo.photoCount}枚）</span>
            </div>
            <div className="storage-meta">
              {persisted !== null && (
                <span className={`persist-badge ${persisted ? 'active' : ''}`}>
                  {persisted ? '永続化済み' : '未永続化'}
                </span>
              )}
              <span className="last-backup-info">
                最終バックアップ: {formatLastBackup()}
              </span>
            </div>
          </div>
        )}

        {/* Storage Mode Section */}
        <div className="settings-section">
          <p className="settings-section-title">💾 画像保存モード</p>
          <div className="storage-mode-options">
            <button
              className={`storage-mode-btn ${storageMode === 'standard' ? 'active' : ''}`}
              onClick={() => handleStorageModeChange('standard')}
              disabled={busy}
            >
              <strong>標準</strong>
              <small>1280px / 高画質</small>
            </button>
            <button
              className={`storage-mode-btn ${storageMode === 'saver' ? 'active' : ''}`}
              onClick={() => handleStorageModeChange('saver')}
              disabled={busy}
            >
              <strong>節約</strong>
              <small>480px / 省容量</small>
            </button>
          </div>
          <button
            className="settings-btn recompress-btn"
            onClick={handleRecompress}
            disabled={busy}
          >
            <span className="settings-btn-icon">🔄</span>
            <span className="settings-btn-text">
              <strong>既存の写真を再圧縮</strong>
              <small>現在のモードで全写真を再圧縮して容量を削減</small>
            </span>
          </button>
        </div>

        {/* Auto-Backup Section */}
        <div className="settings-section">
          <p className="settings-section-title">🔄 自動バックアップ</p>
          {fsSupported ? (
            <>
              <p className="auto-backup-desc">
                ローカルフォルダにZIPを自動保存します。ブラウザのデータを消してもファイルは残ります。
              </p>
              <div className="settings-actions">
                {autoBackupOn ? (
                  <>
                    <div className="auto-backup-status-card active">
                      <span className="auto-backup-status-icon">✅</span>
                      <span>自動バックアップ: 有効</span>
                    </div>
                    <button
                      className="settings-btn auto-backup-active-btn"
                      onClick={async () => {
                        setBusy(true);
                        setStatus('自動バックアップ中...');
                        const ok = await performAutoBackup((msg) => setStatus(msg));
                        if (ok) {
                          markBackupDone();
                          setTimeout(() => setStatus(null), 2000);
                        }
                        setBusy(false);
                      }}
                      disabled={busy}
                    >
                      <span className="settings-btn-icon">💾</span>
                      <span className="settings-btn-text">
                        <strong>今すぐバックアップ</strong>
                        <small>設定済みフォルダにZIPを保存</small>
                      </span>
                    </button>
                    <button
                      className="settings-btn"
                      onClick={async () => {
                        await disableAutoBackup();
                        setAutoBackupOn(false);
                        setStatus('自動バックアップを無効にしました');
                        setTimeout(() => setStatus(null), 2000);
                      }}
                      disabled={busy}
                    >
                      <span className="settings-btn-icon">🚫</span>
                      <span className="settings-btn-text">
                        <strong>自動バックアップを無効化</strong>
                        <small>フォルダへの自動保存を停止</small>
                      </span>
                    </button>
                  </>
                ) : (
                  <button
                    className="settings-btn"
                    onClick={async () => {
                      const ok = await setupAutoBackup();
                      if (ok) {
                        setAutoBackupOn(true);
                        setStatus('自動バックアップを有効にしました');
                        setTimeout(() => setStatus(null), 2000);
                      }
                    }}
                    disabled={busy}
                  >
                    <span className="settings-btn-icon">📂</span>
                    <span className="settings-btn-text">
                      <strong>自動バックアップを有効化</strong>
                      <small>バックアップ先フォルダを選択</small>
                    </span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="auto-backup-desc">
                このブラウザではフォルダ自動保存に対応していません。定期的にZIPをダウンロードして保管してください。
              </p>
              <div className="settings-actions">
                <button className="settings-btn" onClick={handleExport} disabled={busy}>
                  <span className="settings-btn-icon">📲</span>
                  <span className="settings-btn-text">
                    <strong>今すぐバックアップ</strong>
                    <small>ZIPファイルをダウンロード保存</small>
                  </span>
                </button>
              </div>
            </>
          )}
          {encrypted && (
            <div className="backup-encryption-notice">
              ⚠️ バックアップZIPは暗号化されません。安全な場所に保管してください。
            </div>
          )}
        </div>

        {/* Export/Import Section */}
        <div className="settings-section">
          <p className="settings-section-title">📦 エクスポート / インポート</p>
          <div className="settings-actions">
            <button className="settings-btn export-btn" onClick={handleExport} disabled={busy}>
              <span className="settings-btn-icon">📦</span>
              <span className="settings-btn-text">
                <strong>エクスポート</strong>
                <small>写真をZIPでダウンロード</small>
              </span>
            </button>

            <button
              className="settings-btn import-btn"
              onClick={() => importRef.current?.click()}
              disabled={busy}
            >
              <span className="settings-btn-icon">📥</span>
              <span className="settings-btn-text">
                <strong>インポート</strong>
                <small>ZIPから写真を復元</small>
              </span>
            </button>
          </div>
        </div>

        {/* Encryption Section */}
        <div className="settings-section">
          <p className="settings-section-title">🔒 暗号化</p>
          <div className={`encryption-status-card ${encrypted ? 'active' : ''}`}>
            <span className="encryption-status-icon">{encrypted ? '🔒' : '🔓'}</span>
            <span className="encryption-status-text">
              {encrypted ? '暗号化: 有効（AES-256-GCM）' : '暗号化: 無効'}
            </span>
          </div>
          <div className="settings-actions">
            {encrypted ? (
              <button
                className="settings-btn"
                onClick={() => {
                  if (confirm('暗号化を解除しますか？\n写真は復号化されて保存されます。')) {
                    onRemoveEncryption();
                    onClose();
                  }
                }}
                disabled={busy}
              >
                <span className="settings-btn-icon">🔓</span>
                <span className="settings-btn-text">
                  <strong>暗号化を解除</strong>
                  <small>パスワード保護を無効にする</small>
                </span>
              </button>
            ) : (
              <button
                className="settings-btn"
                onClick={() => {
                  onSetupEncryption();
                  onClose();
                }}
                disabled={busy}
              >
                <span className="settings-btn-icon">🔒</span>
                <span className="settings-btn-text">
                  <strong>暗号化を有効にする</strong>
                  <small>パスワードで写真を保護</small>
                </span>
              </button>
            )}
          </div>
        </div>

        <input
          ref={importRef}
          type="file"
          accept=".zip"
          className="hidden-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImport(file);
            e.target.value = '';
          }}
        />

        {status && <div className="settings-status">{status}</div>}

        <button className="btn-secondary settings-close" onClick={onClose} disabled={busy}>
          閉じる
        </button>
      </div>
    </div>
  );
};

export default SettingsMenu;
