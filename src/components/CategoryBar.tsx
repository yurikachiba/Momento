import { type FC, useState } from 'react';
import type { Album } from '../types/photo';
import { stripHtmlTags } from '../lib/sanitize';

interface CategoryBarProps {
  albums: Album[];
  activeAlbumId: string | null;
  onSelectAll: () => void;
  onSelectAlbum: (id: string) => void;
  onAddAlbum: (name: string, icon: string) => void;
  onDeleteAlbum: (id: string) => void;
}

const ICON_OPTIONS = ['🍳', '👶', '✈️', '🌸', '🎂', '🐱', '🏠', '💐', '📚', '🎵', '⭐', '❤️'];

const CategoryBar: FC<CategoryBarProps> = ({
  albums,
  activeAlbumId,
  onSelectAll,
  onSelectAlbum,
  onAddAlbum,
  onDeleteAlbum,
}) => {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICON_OPTIONS[0]);

  const handleAdd = () => {
    const trimmed = stripHtmlTags(newName).trim();
    if (!trimmed) return;
    onAddAlbum(trimmed, selectedIcon);
    setNewName('');
    setSelectedIcon(ICON_OPTIONS[0]);
    setAdding(false);
  };

  return (
    <div className="category-bar-wrapper">
      <div className="category-bar">
        <button
          className={`category-tab ${!activeAlbumId ? 'active' : ''}`}
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
      </div>

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
    </div>
  );
};

export default CategoryBar;
