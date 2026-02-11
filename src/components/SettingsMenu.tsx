import { type FC, useRef, useState } from 'react';
import { exportData, importData } from '../lib/sync';
import {
  saveConfig,
  clearConfig,
  isCloudConfigured,
  type FirebaseConfig,
} from '../lib/firebase';
import { uploadAllToCloud } from '../lib/cloud';

interface SettingsMenuProps {
  onClose: () => void;
  onDataChanged: () => void;
}

const SettingsMenu: FC<SettingsMenuProps> = ({ onClose, onDataChanged }) => {
  const importRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showFirebaseSetup, setShowFirebaseSetup] = useState(false);
  const [cloudConnected, setCloudConnected] = useState(isCloudConfigured);
  const [configJson, setConfigJson] = useState('');

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
      if (result.categoriesImported) parts.push(`フォルダ${result.categoriesImported}個`);
      if (result.albumsImported) parts.push(`アルバム${result.albumsImported}個`);
      setStatus(`完了！ ${parts.join('、')}を追加しました`);
      onDataChanged();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'インポートに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveFirebaseConfig = () => {
    try {
      const config = JSON.parse(configJson) as FirebaseConfig;
      if (!config.storageBucket || !config.apiKey) {
        setStatus('設定が不正です。Firebase consoleからコピーしてください');
        return;
      }
      saveConfig(config);
      setCloudConnected(true);
      setShowFirebaseSetup(false);
      setConfigJson('');
      setStatus('Firebase に接続しました');
    } catch {
      setStatus('JSONの形式が正しくありません');
    }
  };

  const handleDisconnectFirebase = () => {
    if (!confirm('Firebase接続を解除しますか？\nクラウド上の写真はそのまま残ります。')) return;
    clearConfig();
    setCloudConnected(false);
    setStatus('Firebase接続を解除しました');
  };

  const handleUploadAll = async () => {
    setBusy(true);
    setStatus('クラウドにアップロード中...');
    try {
      const count = await uploadAllToCloud((done, total) => {
        setStatus(`アップロード中... ${done}/${total}`);
      });
      setStatus(count > 0 ? `${count}枚をクラウドに保存しました` : 'すべてアップロード済みです');
      onDataChanged();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'アップロードに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="category-add-overlay" onClick={onClose}>
      <div className="category-add-dialog settings-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>データ管理</h3>

        {/* Cloud Section */}
        <div className="settings-section">
          <p className="settings-section-title">☁️ クラウド保存</p>
          {cloudConnected ? (
            <>
              <div className="cloud-status connected">
                <span className="cloud-dot" />
                Firebase 接続中
                <button className="cloud-disconnect" onClick={handleDisconnectFirebase}>
                  解除
                </button>
              </div>
              <button
                className="settings-btn cloud-btn"
                onClick={handleUploadAll}
                disabled={busy}
              >
                <span className="settings-btn-icon">☁️</span>
                <span className="settings-btn-text">
                  <strong>全部クラウドに送る</strong>
                  <small>写真をアップロードしてスマホの容量を空ける</small>
                </span>
              </button>
            </>
          ) : (
            <>
              <p className="settings-desc">
                Firebaseに接続して写真をクラウド保存。
                スマホの容量を節約できます。
              </p>
              {showFirebaseSetup ? (
                <div className="firebase-setup">
                  <textarea
                    className="firebase-config-input"
                    placeholder={'Firebase consoleから設定JSONを貼り付け\n例: { "apiKey": "...", "storageBucket": "..." }'}
                    value={configJson}
                    onChange={(e) => setConfigJson(e.target.value)}
                    rows={6}
                  />
                  <div className="dialog-actions">
                    <button className="btn-secondary" onClick={() => setShowFirebaseSetup(false)}>
                      キャンセル
                    </button>
                    <button className="btn-primary" onClick={handleSaveFirebaseConfig}>
                      接続
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="settings-btn"
                  onClick={() => setShowFirebaseSetup(true)}
                  disabled={busy}
                >
                  <span className="settings-btn-icon">🔗</span>
                  <span className="settings-btn-text">
                    <strong>Firebaseに接続</strong>
                    <small>設定JSONを貼り付けて接続</small>
                  </span>
                </button>
              )}
            </>
          )}
        </div>

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
