import { type FC, useState } from 'react';
import type { Album, SharedAlbum, AlbumShareEntry } from '../types/photo';
import { stripHtmlTags } from '../lib/sanitize';
import { shareAlbum, revokeAlbumShare, getAlbumShares } from '../lib/api';

interface CategoryBarProps {
  albums: Album[];
  activeAlbumId: string | null;
  onSelectAll: () => void;
  onSelectAlbum: (id: string) => void;
  onAddAlbum: (name: string, icon: string) => void;
  onDeleteAlbum: (id: string) => void;
  sharedAlbums: SharedAlbum[];
  activeSharedAlbumId: string | null;
  onSelectSharedAlbum: (id: string) => void;
}

const ICON_OPTIONS = ['🍳', '👶', '✈️', '🌸', '🎂', '🐱', '🏠', '💐', '📚', '🎵', '⭐', '❤️'];

const CategoryBar: FC<CategoryBarProps> = ({
  albums,
  activeAlbumId,
  onSelectAll,
  onSelectAlbum,
  onAddAlbum,
  onDeleteAlbum,
  sharedAlbums,
  activeSharedAlbumId,
  onSelectSharedAlbum,
}) => {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICON_OPTIONS[0]);

  // 共有管理ダイアログ
  const [sharingAlbumId, setSharingAlbumId] = useState<string | null>(null);
  const [shareUsername, setShareUsername] = useState('');
  const [shareError, setShareError] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shares, setShares] = useState<AlbumShareEntry[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);

  const handleAdd = () => {
    const trimmed = stripHtmlTags(newName).trim();
    if (!trimmed) return;
    onAddAlbum(trimmed, selectedIcon);
    setNewName('');
    setSelectedIcon(ICON_OPTIONS[0]);
    setAdding(false);
  };

  const openShareDialog = async (albumId: string) => {
    setSharingAlbumId(albumId);
    setShareUsername('');
    setShareError('');
    setSharesLoading(true);
    try {
      setShares(await getAlbumShares(albumId));
    } catch {
      setShares([]);
    }
    setSharesLoading(false);
  };

  const handleShare = async () => {
    if (!sharingAlbumId || !shareUsername.trim()) return;
    setShareLoading(true);
    setShareError('');
    try {
      const entry = await shareAlbum(sharingAlbumId, shareUsername.trim());
      setShares((prev) => [...prev, entry]);
      setShareUsername('');
    } catch (err) {
      setShareError(err instanceof Error ? err.message : '共有に失敗しました');
    }
    setShareLoading(false);
  };

  const handleRevoke = async (userId: string) => {
    if (!sharingAlbumId) return;
    if (!confirm('この人への共有を解除しますか？')) return;
    try {
      await revokeAlbumShare(sharingAlbumId, userId);
      setShares((prev) => prev.filter((s) => s.userId !== userId));
    } catch {
      // ignore
    }
  };

  const sharingAlbum = albums.find((a) => a.id === sharingAlbumId);

  return (
    <div className="category-bar-wrapper">
      <div className="category-bar">
        <button
          className={`category-tab ${!activeAlbumId && !activeSharedAlbumId ? 'active' : ''}`}
          onClick={onSelectAll}
        >
          📷 すべて
        </button>
        {albums.map((album) => (
          <button
            key={album.id}
            className={`category-tab album-tab ${activeAlbumId === album.id ? 'active' : ''}`}
            onClick={() => onSelectAlbum(album.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (confirm(`「${album.name}」アルバムを削除しますか？\n写真自体は削除されません。`)) {
                onDeleteAlbum(album.id);
              }
            }}
          >
            {album.icon} {album.name}
          </button>
        ))}
        <button className="category-tab add-tab" onClick={() => setAdding(true)}>
          ＋
        </button>

        {sharedAlbums.length > 0 && (
          <>
            <span className="category-divider">|</span>
            {sharedAlbums.map((album) => (
              <button
                key={`shared-${album.id}`}
                className={`category-tab shared-tab ${activeSharedAlbumId === album.id ? 'active' : ''}`}
                onClick={() => onSelectSharedAlbum(album.id)}
              >
                {album.icon} {album.name}
                <span className="shared-badge">共有</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* 共有管理ボタン（アルバム選択時に表示） */}
      {activeAlbumId && (
        <div className="share-action-bar">
          <button className="share-manage-btn" onClick={() => openShareDialog(activeAlbumId)}>
            👥 家族に共有
          </button>
        </div>
      )}

      {adding && (
        <div className="category-add-overlay" onClick={() => setAdding(false)}>
          <div className="category-add-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>新しいアルバム</h3>
            <div className="icon-picker">
              {ICON_OPTIONS.map((icon) => (
                <button
                  key={icon}
                  className={`icon-option ${selectedIcon === icon ? 'selected' : ''}`}
                  onClick={() => setSelectedIcon(icon)}
                >
                  {icon}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="input-name"
              placeholder="アルバム名（例：夏の思い出）"
              value={newName}
              maxLength={50}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              autoFocus
            />
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setAdding(false)}>
                キャンセル
              </button>
              <button className="btn-primary" onClick={handleAdd} disabled={!newName.trim()}>
                作成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 共有管理ダイアログ */}
      {sharingAlbumId && sharingAlbum && (
        <div className="category-add-overlay" onClick={() => setSharingAlbumId(null)}>
          <div className="share-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>👥 アルバムを共有</h3>
            <p className="share-dialog-album-name">
              {sharingAlbum.icon} {sharingAlbum.name}
            </p>

            <div className="share-invite-section">
              <p className="share-invite-label">ユーザー名で招待</p>
              <div className="share-invite-row">
                <input
                  type="text"
                  className="input-name share-invite-input"
                  placeholder="ユーザー名を入力"
                  value={shareUsername}
                  maxLength={30}
                  onChange={(e) => setShareUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleShare()}
                  autoFocus
                />
                <button
                  className="btn-primary share-invite-btn"
                  onClick={handleShare}
                  disabled={!shareUsername.trim() || shareLoading}
                >
                  招待
                </button>
              </div>
              {shareError && <p className="share-error">{shareError}</p>}
            </div>

            {sharesLoading ? (
              <p className="share-loading">読み込み中...</p>
            ) : shares.length > 0 ? (
              <div className="share-list-section">
                <p className="share-list-label">共有中のユーザー</p>
                <div className="share-list">
                  {shares.map((s) => (
                    <div key={s.userId} className="share-list-item">
                      <div className="share-list-user">
                        <span className="share-list-name">{s.displayName}</span>
                        <span className="share-list-username">@{s.username}</span>
                      </div>
                      <button
                        className="share-revoke-btn"
                        onClick={() => handleRevoke(s.userId)}
                      >
                        解除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="share-empty">まだ誰にも共有していません</p>
            )}

            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setSharingAlbumId(null)} style={{ flex: 1 }}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryBar;
