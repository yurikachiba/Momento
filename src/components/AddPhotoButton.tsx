import { type FC, useRef, useState } from 'react';

interface AddPhotoButtonProps {
  onFiles: (files: FileList, quality: string) => void;
}

const AddPhotoButton: FC<AddPhotoButtonProps> = ({ onFiles }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showQuality, setShowQuality] = useState(false);
  const [quality, setQuality] = useState<string>(() => {
    return localStorage.getItem('momento-quality') || 'auto';
  });
  const pendingFilesRef = useRef<FileList | null>(null);

  const handleFilesChosen = (files: FileList) => {
    pendingFilesRef.current = files;
    setShowQuality(true);
  };

  const handleUpload = () => {
    if (pendingFilesRef.current) {
      localStorage.setItem('momento-quality', quality);
      onFiles(pendingFilesRef.current, quality);
      pendingFilesRef.current = null;
      setShowQuality(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden-input"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesChosen(e.target.files);
            e.target.value = '';
          }
        }}
      />
      <button
        className="fab"
        onClick={() => inputRef.current?.click()}
        aria-label="写真を追加"
      >
        <span className="fab-icon">＋</span>
        <span className="fab-label">写真を追加</span>
      </button>

      {showQuality && (
        <div className="quality-overlay" onClick={() => setShowQuality(false)}>
          <div
            className="quality-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>画質を選択</h3>
            <div className="quality-options">
              <button
                className={`quality-btn ${quality === 'high' ? 'active' : ''}`}
                onClick={() => setQuality('high')}
              >
                <strong>高画質</strong>
                <small>オリジナルに近い画質</small>
              </button>
              <button
                className={`quality-btn ${quality === 'auto' ? 'active' : ''}`}
                onClick={() => setQuality('auto')}
              >
                <strong>自動</strong>
                <small>バランス良好（おすすめ）</small>
              </button>
              <button
                className={`quality-btn ${quality === 'light' ? 'active' : ''}`}
                onClick={() => setQuality('light')}
              >
                <strong>軽量</strong>
                <small>容量を節約</small>
              </button>
            </div>
            <div className="dialog-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowQuality(false)}
              >
                キャンセル
              </button>
              <button className="btn-primary" onClick={handleUpload}>
                アップロード
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AddPhotoButton;
