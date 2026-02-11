import { type FC, useState } from 'react';
import type { Category } from '../types/photo';

interface CategoryBarProps {
  categories: Category[];
  activeCategoryId: string;
  onSelect: (id: string) => void;
  onAdd: (name: string, icon: string) => void;
  onDelete: (id: string) => void;
}

const ICON_OPTIONS = ['🍳', '👶', '✈️', '🌸', '🎂', '🐱', '🏠', '💐', '📚', '🎵', '⭐', '❤️'];

const CategoryBar: FC<CategoryBarProps> = ({
  categories,
  activeCategoryId,
  onSelect,
  onAdd,
  onDelete,
}) => {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICON_OPTIONS[0]);

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAdd(trimmed, selectedIcon);
    setNewName('');
    setSelectedIcon(ICON_OPTIONS[0]);
    setAdding(false);
  };

  return (
    <div className="category-bar-wrapper">
      <div className="category-bar">
        <button
          className={`category-tab ${activeCategoryId === 'all' ? 'active' : ''}`}
          onClick={() => onSelect('all')}
        >
          📁 すべて
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`category-tab ${activeCategoryId === cat.id ? 'active' : ''}`}
            onClick={() => onSelect(cat.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (confirm(`「${cat.name}」フォルダを削除しますか？\n中の写真は「すべて」に移動されます。`)) {
                onDelete(cat.id);
              }
            }}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
        <button className="category-tab add-tab" onClick={() => setAdding(true)}>
          ＋
        </button>
      </div>

      {adding && (
        <div className="category-add-overlay" onClick={() => setAdding(false)}>
          <div className="category-add-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>新しいフォルダ</h3>
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
              placeholder="フォルダ名（例：お料理）"
              value={newName}
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
