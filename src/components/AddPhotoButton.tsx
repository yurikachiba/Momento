import { type FC, useRef } from 'react';

interface AddPhotoButtonProps {
  onFiles: (files: FileList) => void;
}

const AddPhotoButton: FC<AddPhotoButtonProps> = ({ onFiles }) => {
  const inputRef = useRef<HTMLInputElement>(null);

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
            onFiles(e.target.files);
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
    </>
  );
};

export default AddPhotoButton;
