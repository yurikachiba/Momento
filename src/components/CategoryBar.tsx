import { type FC, useState } from 'react';
import type { Category, Album } from '../types/photo';

interface CategoryBarProps {
  categories: Category[];
  albums: Album[];
  activeCategoryId: string;
  activeAlbumId: string | null;
  onSelectCategory: (id: string) => void;
  onSelectAlbum: (id: string) => void;
  onAddCategory: (name: string, icon: string) => void;
  onDeleteCategory: (id: string) => void;
  onAddAlbum: (name: string, icon: string) => void;
  onDeleteAlbum: (id: string) => void;
}

const ICON_OPTIONS = ['🍳', '👶', '✈️', '🌸', '🎂', '🐱', '🏠', '💐', '📚', '🎵', '⭐', '❤️'];

const CategoryBar: FC<CategoryBarProps> = ({
  categories,
  albums,
  activeCategoryId,
  activeAlbumId,
  onSelectCategory,
  onSelectAlbum,
  onAddCategory,
  onDeleteCategory,
  onAddAlbum,
  onDeleteAlbum,
}) => {
  const [adding, setAdding] = useState<'category' | 'album' | null>(null);
  const [newName, setNewName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICON_OPTIONS[0]);

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (adding === 'category') {
      onAddCategory(trimmed, selectedIcon);
    } else if (adding === 'album') {
      onAddAlbum(trimmed, selectedIcon);
    }
    setNewName('');
    setSelectedIcon(ICON_OPTIONS[0]);
    setAdding(null);
  };

  return (
    <div className="category-bar-wrapper">
      <div className="category-bar">
        <button
          className={`category-tab ${activeCategoryId === 'all' && !activeAlbumId ? 'active' : ''}`}
          onClick={() => onSelectCategory('all')}
        >
          📁 すべて
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`category-tab ${activeCategoryId === cat.id && !activeAlbumId ? 'active' : ''}`}
            onClick={() => onSelectCategory(cat.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (confirm(`「${cat.name}」フォルダを削除しますか？\n中の写真は「すべて」に移動されます。`)) {
                onDeleteCategory(cat.id);
              }
            }}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
        <button className="category-tab add-tab" onClick={() => setAdding('category')}>
          ＋
        </button>

        {albums.length > 0 && <span className="bar-divider" />}

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
        <button className="category-tab add-tab album-add-tab" onClick={() => setAdding('album')}>
          ＋📖
        </button>
      </div>

      {adding && (
        <div className="category-add-overlay" onClick={() => setAdding(null)}>
          <div className="category-add-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{adding === 'category' ? '新しいフォルダ' : '新しいアルバム'}</h3>
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
              placeholder={adding === 'category' ? 'フォルダ名（例：お料理）' : 'アルバム名（例：夏の思い出）'}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              autoFocus
            />
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setAdding(null)}>
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
