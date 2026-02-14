import { useEffect, type FC } from 'react';

interface ToastProps {
  message: string;
  visible: boolean;
  onHide: () => void;
}

const Toast: FC<ToastProps> = ({ message, visible, onHide }) => {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onHide, 2500);
    return () => clearTimeout(timer);
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <div className="toast">
      {message}
    </div>
  );
};

export default Toast;
