import { type FC, useRef, useState } from 'react';
import { exportData, importData } from '../lib/sync';
import { isEncryptionEnabled } from '../lib/crypto';

interface SettingsMenuProps {
  onClose: () => void;
  onDataChanged: () => void;
  onSetupEncryption: () => void;
  onRemoveEncryption: () => void;
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

  const encrypted = isEncryptionEnabled();

  const handleExport = async () => {
    setBusy(true);
    setStatus('エクスポート準備中...');
    try {
      await exportData((done, total) => {
        setStatus(`写真を圧縮中... ${done}/${total}`);
      });
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
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'インポートに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="category-add-overlay" onClick={onClose}>
      <div className="category-add-dialog settings-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>データ管理</h3>

        {/* Export/Import Section */}
        <div className="settings-section">
          <p className="settings-section-title">📦 バックアップ</p>
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
