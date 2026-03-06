import React, { useRef } from 'react';
import { format, isSameMonth, isToday } from 'date-fns';

interface PhotoCellProps {
  date: Date;
  currentMonth: Date;
  photoBlob?: Blob | string;
  onUpload: (file: File) => void;
  isShareMode: boolean;
}

const PhotoCell: React.FC<PhotoCellProps> = ({ date, currentMonth, photoBlob, onUpload, isShareMode }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCurrentMonth = isSameMonth(date, currentMonth);
  const isDateToday = isToday(date);
  
  // Convert Blob to Data URL for stability in export
  const [photoDataUrl, setPhotoDataUrl] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (!photoBlob) {
      setPhotoDataUrl(undefined);
      return;
    }

    if (typeof photoBlob === 'string') {
      setPhotoDataUrl(photoBlob);
      return;
    }

    // It's a Blob
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoDataUrl(reader.result as string);
    };
    reader.readAsDataURL(photoBlob);
    
    // No cleanup needed for Data URL string
  }, [photoBlob]);

  const handleClick = () => {
    if (!isShareMode) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    // Reset input value
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isCurrentMonth) {
    return <div className="aspect-square bg-transparent"></div>;
  }

  // Determine date display style
  // 1. Normal Mode & No Photo: Centered, Large
  // 2. Share Mode & No Photo: Top-Left, Small
  // 3. Normal Mode & Photo: Hidden (Hover to show)
  // 4. Share Mode & Photo: Top-Left, Small (Overlay)

  return (
    <div 
      className={`relative aspect-square border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden group 
        ${!isShareMode ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} 
        rounded-xl ${isShareMode ? 'border-none bg-gray-50' : ''}`}
      onClick={handleClick}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />

      {photoDataUrl ? (
        <>
          <img 
            src={photoDataUrl} 
            alt={format(date, 'yyyy-MM-dd')} 
            className="w-full h-full object-cover"
          />
          {/* Date overlay on hover (Normal Mode) */}
          {!isShareMode && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="text-white font-bold text-xl drop-shadow-md">
                {format(date, 'd')}
              </span>
            </div>
          )}
          {/* Date overlay (Share Mode) */}
          {isShareMode && (
            <div className="absolute top-2 right-2">
              <span className="text-white/80 font-medium text-xs drop-shadow-sm">
                {format(date, 'd')}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center relative p-1">
          {/* Date number */}
          {isShareMode ? (
            // Share Mode: Small, Top-Right
            <span className={`absolute top-2 right-2 text-xs font-medium ${isDateToday ? 'text-blue-500' : 'text-gray-400'}`}>
              {format(date, 'd')}
            </span>
          ) : (
            // Normal Mode: Large, Centered
            <span className={`text-3xl font-bold ${isDateToday ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'}`}>
              {format(date, 'd')}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default PhotoCell;
