import React from 'react';

export const Overlay = ({ isShown }: { isShown: boolean }) => {
  if (!isShown) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 overflow-y-auto">
      <div
        className="w-full h-full"
        onClick={(e) => e.preventDefault()}
        style={{ pointerEvents: 'auto' }}
      >
        {/* The rest of your overlay content goes here */}
      </div>
    </div>
  );
};

export default Overlay;
