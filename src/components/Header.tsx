import { type FC } from 'react';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

const Header: FC<HeaderProps> = ({ title, onBack, rightAction }) => {
  return (
    <header className="app-header">
      <div className="header-left">
        {onBack && (
          <button className="btn-icon" onClick={onBack} aria-label="戻る">
            ←
          </button>
        )}
      </div>
      <h1 className="header-title">{title}</h1>
      <div className="header-right">{rightAction}</div>
    </header>
  );
};

export default Header;
