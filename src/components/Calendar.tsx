import React, { useState, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addMonths, 
  subMonths
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Download, Loader2, X } from 'lucide-react';
import { toPng } from 'html-to-image';
import { db } from '../db/db';
import PhotoCell from './PhotoCell';
import { resizeImage } from '../utils/image';

const Calendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isExporting, setIsExporting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = useMemo(() => 
    eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
    [calendarStart, calendarEnd]
  );

  // Define query range
  const startDateStr = format(calendarStart, 'yyyy-MM-dd');
  const endDateStr = format(calendarEnd, 'yyyy-MM-dd');

  // Fetch photos for the visible range
  const photos = useLiveQuery(
    () => db.photos.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    [startDateStr, endDateStr]
  );

  // Create a map for quick lookup: date string -> photo data url (base64) or blob
  const photosMap = useMemo(() => {
    const map = new Map<string, string | Blob>();
    photos?.forEach(p => {
      // For export stability, we might need to convert blobs to data URLs if using html-to-image with blobs fails
      // But let's try to keep it simple first. 
      // The issue "net::ERR_FILE_NOT_FOUND blob:..." suggests html-to-image struggles to fetch the blob URL during capture
      // because the blob URL might be revoked or not accessible in the cloned node context.
      // However, we are using URL.createObjectURL in PhotoCell.
      
      // Let's pass the blob directly, and handle conversion in PhotoCell if needed.
      map.set(p.date, p.data);
    });
    return map;
  }, [photos]);

  const handlePrevMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleExport = async () => {
    if (isExporting || !exportRef.current) return;
    
    setIsExporting(true);
    
    // Allow a brief moment for any potential state updates
    setTimeout(async () => {
      try {
        if (!exportRef.current) return;
        
        const dataUrl = await toPng(exportRef.current, {
          cacheBust: true,
          pixelRatio: 2, // High resolution
          backgroundColor: '#ffffff',
          style: {
            transform: 'scale(1)', // Reset any transforms
          }
        });
        
        setPreviewImage(dataUrl);
      } catch (err) {
        console.error('Export failed:', err);
        alert('生成预览失败，请重试');
      } finally {
        setIsExporting(false);
      }
    }, 100); 
  };

  const handleDownload = () => {
    if (previewImage) {
      const link = document.createElement('a');
      link.download = `photo-calendar-${format(currentDate, 'yyyy-MM')}.png`;
      link.href = previewImage;
      link.click();
      // Optional: Close preview after download?
      // setPreviewImage(null);
    }
  };

  const handleClosePreview = () => {
    setPreviewImage(null);
  };

  const handleUpload = async (date: Date, file: File) => {
    try {
      // Resize image before storing (max 1200px width/height)
      const resizedBlob = await resizeImage(file, 1200);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      await db.photos.put({
        date: dateStr,
        data: resizedBlob,
        mimeType: file.type
      });
    } catch (error) {
      console.error('Failed to upload photo:', error);
      alert('Failed to save photo. Please try again.');
    }
  };

  const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto p-4 space-y-4">
      {/* Header Controls - Hide in share/export mode if you want clean image, 
          but usually people want the month title. We'll keep the title but maybe hide buttons in export? 
          For now, let's keep it simple and just capture the grid area + title. */}
      
      <div className="flex items-center justify-between relative z-20">
        {/* Left Controls: Title and Navigation */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button 
              onClick={handlePrevMonth}
              className="p-2 rounded-md hover:bg-white dark:hover:bg-gray-700 shadow-sm transition-all cursor-pointer text-gray-700 dark:text-gray-200"
              title="上个月"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white px-4 min-w-[140px] text-center select-none">
              {format(currentDate, 'yyyy年 M月')}
            </h2>
            <button 
              onClick={handleNextMonth}
              className="p-2 rounded-md hover:bg-white dark:hover:bg-gray-700 shadow-sm transition-all cursor-pointer text-gray-700 dark:text-gray-200"
              title="下个月"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        
        {/* Right Controls: Actions */}
        <div className="flex items-center space-x-2">
           <button 
            onClick={handleToday}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
            title="回到今天"
          >
            <CalendarIcon size={18} />
            <span>今天</span>
          </button>
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className={`flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-sm ${isExporting ? 'opacity-70 cursor-wait' : ''}`}
            title="导出图片"
          >
            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            <span>{isExporting ? '生成中...' : '导出'}</span>
          </button>
        </div>
      </div>
      
      {/* Loading Overlay */}
      {isExporting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl flex flex-col items-center space-y-4">
            <Loader2 size={48} className="text-blue-500 animate-spin" />
            <p className="text-gray-700 dark:text-gray-200 font-medium">正在生成精美月历...</p>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">导出预览</h3>
              <button 
                onClick={handleClosePreview}
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Content - Scrollable Image */}
            <div className="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-black flex items-center justify-center">
              <img 
                src={previewImage} 
                alt="Calendar Preview" 
                className="max-w-full h-auto shadow-lg rounded-lg object-contain" 
                style={{ maxHeight: 'calc(90vh - 140px)' }}
              />
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end gap-3">
              <button 
                onClick={handleClosePreview}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium"
              >
                取消
              </button>
              <button 
                onClick={handleDownload}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all font-medium transform active:scale-95"
              >
                <Download size={18} />
                保存到本地
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Area (Interactive) */}
      <div 
        ref={calendarRef} 
        className="bg-gray-50 dark:bg-gray-900 p-2 rounded-xl"
      >
        {/* Weekday Header */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-sm font-medium py-2 text-gray-500 dark:text-gray-400">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const photoBlob = photosMap.get(dateStr);
            
            return (
              <PhotoCell
                key={dateStr}
                date={day}
                currentMonth={currentDate}
                photoBlob={photoBlob}
                onUpload={(file) => handleUpload(day, file)}
                isShareMode={false}
              />
            );
          })}
        </div>
      </div>

      {/* Hidden Export Template (Off-screen) */}
      <div 
        ref={exportRef}
        className={`fixed flex flex-col items-center py-20 px-12 box-border font-sans ${isExporting ? 'top-0 left-0 z-40' : 'top-0 left-[-9999px]'}`}
        style={{ 
          width: '1080px', 
          backgroundColor: '#F3F4F6', // Light gray background
          backgroundImage: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)', // Subtle gradient
          minHeight: '100vh', // Ensure full coverage
        }}
      >
        {/* Main Card */}
        <div className="bg-white w-full rounded-[48px] shadow-2xl overflow-hidden p-12">
          {/* Header */}
          <div className="flex justify-between items-baseline mb-10 border-b-4 border-black pb-6">
              <h1 className="text-8xl font-black text-black tracking-tighter uppercase">{format(currentDate, 'MMM')}</h1>
              <h2 className="text-6xl font-light text-gray-400">{format(currentDate, 'yyyy')}</h2>
          </div>

          {/* Grid Headers */}
          <div className="grid grid-cols-7 gap-4 mb-4">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xl font-bold text-gray-300 uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>

          {/* Grid Content */}
          <div className="grid grid-cols-7 gap-4">
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const photoBlob = photosMap.get(dateStr);
              
              return (
                <PhotoCell
                  key={`export-${dateStr}`}
                  date={day}
                  currentMonth={currentDate}
                  photoBlob={photoBlob}
                  onUpload={() => {}} // No interaction in export view
                  isShareMode={true}
                />
              );
            })}
          </div>
          
          {/* Footer in Card */}
          <div className="mt-12 pt-8 border-t-2 border-gray-100 flex justify-between items-center text-gray-400">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-gray-800 tracking-tight">Monthly Moments</span>
                <span className="text-sm tracking-wider uppercase mt-1">Photo Calendar Collection</span>
              </div>
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                <CalendarIcon size={24} className="text-gray-400" />
              </div>
          </div>
        </div>

        {/* Poster Footer */}
        <div className="mt-16 text-gray-400 font-medium tracking-[0.5em] text-xl flex items-center gap-4 opacity-60">
          <span>COLLECT</span>
          <span className="w-2 h-2 rounded-full bg-gray-400"></span>
          <span>YOUR</span>
          <span className="w-2 h-2 rounded-full bg-gray-400"></span>
          <span>MEMORIES</span>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
