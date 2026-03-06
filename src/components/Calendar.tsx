import React, { useState, useMemo, useRef, useEffect } from 'react';
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
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Download, Loader2, X, Palette, Check, Layout } from 'lucide-react';
import { toPng } from 'html-to-image';
import { db } from '../db/db';
import PhotoCell from './PhotoCell';
import { resizeImage } from '../utils/image';

// Template Definitions
interface TemplateConfig {
  id: string;
  name: string;
  bgColor: string;
  bgImage?: string;
  cardBg: string;
  cardBorder?: string;
  textColor: string;
  accentColor: string;
  fontFamily?: string;
  headerStyle: 'modern' | 'classic' | 'minimal';
  cellStyle: 'rounded' | 'sharp' | 'film';
  showFooter: boolean;
}

const TEMPLATES: TemplateConfig[] = [
  {
    id: 'classic',
    name: '经典杂志',
    bgColor: '#F3F4F6',
    bgImage: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
    cardBg: '#FFFFFF',
    textColor: '#1F2937',
    accentColor: '#9CA3AF',
    headerStyle: 'modern',
    cellStyle: 'rounded',
    showFooter: true
  },
  {
    id: 'midnight',
    name: '暗夜黑金',
    bgColor: '#000000',
    bgImage: 'linear-gradient(to bottom right, #111827, #000000)',
    cardBg: '#111827',
    cardBorder: '1px solid #374151',
    textColor: '#F9FAFB',
    accentColor: '#D1D5DB', // Gold-ish can be achieved with specific hex if needed, sticking to grays for now or custom
    headerStyle: 'classic',
    cellStyle: 'rounded',
    showFooter: true
  },
  {
    id: 'cream',
    name: '复古奶油',
    bgColor: '#FFFBEB', // Amber-50
    bgImage: 'linear-gradient(to bottom right, #FFFBEB, #FEF3C7)',
    cardBg: '#FEFCE8', // Yellow-50ish
    cardBorder: '2px solid #78350F', // Amber-900
    textColor: '#78350F',
    accentColor: '#92400E',
    headerStyle: 'minimal',
    cellStyle: 'sharp',
    showFooter: true
  },
  {
    id: 'morandi',
    name: '莫兰迪',
    bgColor: '#D6D2C4', // Muted beige
    bgImage: 'linear-gradient(120deg, #D6D2C4 0%, #B8B09C 100%)',
    cardBg: '#F0EFE9', // Off-white
    textColor: '#5E503F', // Dark taupe
    accentColor: '#8C7B6C', // Medium taupe
    headerStyle: 'minimal',
    cellStyle: 'rounded',
    showFooter: true
  },
  {
    id: 'japan',
    name: '日式和风',
    bgColor: '#e6e0d4',
    bgImage: 'linear-gradient(to bottom right, #e6e0d4, #f5f1e8)', // Use gradient instead of external pattern
    cardBg: '#ffffff',
    cardBorder: 'none',
    textColor: '#c44d44', // Traditional red
    accentColor: '#2f3e46', // Dark slate
    headerStyle: 'minimal',
    cellStyle: 'rounded',
    showFooter: true
  },
  {
    id: 'forest',
    name: '森系清新',
    bgColor: '#E3EEDD',
    bgImage: 'linear-gradient(to top, #E3EEDD 0%, #F3F8F2 100%)',
    cardBg: '#FFFFFF',
    textColor: '#2D4F2F', // Forest Green
    accentColor: '#7AA375', // Sage Green
    headerStyle: 'classic',
    cellStyle: 'rounded',
    showFooter: true
  }
];

const Calendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isExporting, setIsExporting] = useState(false);
  const [showOrientationModal, setShowOrientationModal] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentTemplateId, setCurrentTemplateId] = useState<string>('classic');
  const calendarRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const currentTemplate = useMemo(() => 
    TEMPLATES.find(t => t.id === currentTemplateId) || TEMPLATES[0], 
    [currentTemplateId]
  );

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

  const handleExportClick = () => {
    if (isExporting) return;
    setShowOrientationModal(true);
  };

  const handleOrientationSelect = (selectedOrientation: 'portrait' | 'landscape') => {
    setOrientation(selectedOrientation);
    setShowOrientationModal(false);
    // Use setTimeout to allow state update and DOM render of exportRef with new dimensions
    setTimeout(() => {
      generateImage();
    }, 100);
  };

  // Function to generate image
  const generateImage = async () => {
    if (!exportRef.current) return;
    
    // Explicitly reset any existing inline styles on the export container to avoid leakage
    exportRef.current.style.backgroundColor = '';
    exportRef.current.style.backgroundImage = '';
    
    try {
      setIsExporting(true);
      setPreviewImage(null); 
      
      // Force React render cycle to apply new template classes/styles
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Direct DOM manipulation to ensure background is correct right before capture
      // This bypasses any React state lag or html-to-image style inheritance issues
      if (exportRef.current) {
        exportRef.current.style.backgroundColor = currentTemplate.bgColor;
        exportRef.current.style.backgroundImage = currentTemplate.bgImage || 'none';
      }

      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 2, 
        backgroundColor: currentTemplate.bgColor, 
        width: orientation === 'landscape' ? 1920 : 1080,
        height: orientation === 'landscape' ? 1080 : undefined, // Let height grow for portrait, fix for landscape
        style: {
          transform: 'scale(1)',
          // Double ensure style in the cloned node
          backgroundImage: currentTemplate.bgImage || 'none', 
          backgroundColor: currentTemplate.bgColor 
        }
      });
      setPreviewImage(dataUrl);
    } catch (err) {
      console.error('Export failed:', err);
      alert('生成预览失败，请重试');
    } finally {
      setIsExporting(false);
      // Clean up inline styles after export
      if (exportRef.current) {
        exportRef.current.style.backgroundColor = '';
        exportRef.current.style.backgroundImage = '';
      }
    }
  };

  // Re-generate when template changes (only if already in preview mode)
  useEffect(() => {
    if (previewImage && !isExporting) {
       generateImage();
    }
  }, [currentTemplateId]);

  const handleDownload = () => {
    if (previewImage) {
      const link = document.createElement('a');
      link.download = `photo-calendar-${format(currentDate, 'yyyy-MM')}-${currentTemplateId}.png`;
      link.href = previewImage;
      link.click();
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
            onClick={handleExportClick}
            disabled={isExporting}
            className={`flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-sm ${isExporting ? 'opacity-70 cursor-wait' : ''}`}
            title="导出图片"
          >
            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            <span>{isExporting ? '生成中...' : '导出'}</span>
          </button>
        </div>
      </div>
      
      {/* Orientation Selection Modal */}
      {showOrientationModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-md w-full transform scale-100 transition-all">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">选择海报方向</h3>
              <button 
                onClick={() => setShowOrientationModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleOrientationSelect('portrait')}
                className="group flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
              >
                <div className="w-20 h-28 bg-gray-200 dark:bg-gray-700 rounded-md border-2 border-gray-300 dark:border-gray-600 group-hover:border-blue-400 shadow-sm flex items-center justify-center">
                  <Layout size={24} className="text-gray-400 group-hover:text-blue-500" />
                </div>
                <span className="font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600">竖版海报</span>
              </button>
              
              <button
                onClick={() => handleOrientationSelect('landscape')}
                className="group flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
              >
                <div className="w-28 h-20 bg-gray-200 dark:bg-gray-700 rounded-md border-2 border-gray-300 dark:border-gray-600 group-hover:border-blue-400 shadow-sm flex items-center justify-center">
                  <Layout size={24} className="text-gray-400 group-hover:text-blue-500 transform rotate-90" />
                </div>
                <span className="font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600">横版海报</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
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
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-6xl w-full h-[90vh] flex overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Left Side: Image Preview */}
            <div className="flex-1 overflow-auto p-8 bg-gray-100 dark:bg-black flex items-center justify-center relative">
               {isExporting && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10 backdrop-blur-[1px]">
                   <Loader2 size={48} className="text-white animate-spin drop-shadow-lg" />
                 </div>
               )}
              <img 
                src={previewImage} 
                alt="Calendar Preview" 
                className="max-w-full h-auto shadow-2xl rounded-lg object-contain transition-opacity duration-300" 
                style={{ maxHeight: 'calc(90vh - 64px)', opacity: isExporting ? 0.7 : 1 }}
              />
            </div>

            {/* Right Side: Controls */}
            <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">导出设置</h3>
                <button 
                  onClick={handleClosePreview}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Template Selector */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Palette size={16} /> 选择风格
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {TEMPLATES.map(template => (
                      <button
                        key={template.id}
                        onClick={() => setCurrentTemplateId(template.id)}
                        className={`group relative p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                          currentTemplateId === template.id 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500' 
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-semibold ${currentTemplateId === template.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                            {template.name}
                          </span>
                          {currentTemplateId === template.id && (
                            <Check size={16} className="text-blue-500" />
                          )}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <div className="w-6 h-6 rounded-full border border-gray-300 shadow-sm" style={{ background: template.bgColor }}></div>
                          <div className="w-6 h-6 rounded-md border border-gray-300 shadow-sm" style={{ background: template.cardBg }}></div>
                          <div className="w-6 h-6 rounded-sm border border-gray-300 shadow-sm" style={{ background: template.textColor }}></div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Footer Actions */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 space-y-3">
                <button 
                  onClick={handleDownload}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all font-bold text-lg transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                  保存图片
                </button>
                <button 
                  onClick={handleClosePreview}
                  className="w-full px-6 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors font-medium"
                >
                  取消
                </button>
              </div>
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
        className={`fixed flex ${orientation === 'landscape' ? 'flex-row' : 'flex-col'} items-center ${orientation === 'landscape' ? 'p-12 gap-12' : 'py-12 px-8'} box-border font-sans ${isExporting ? 'top-0 left-0 z-40' : 'top-0 left-[-9999px]'}`}
        style={{ 
          width: orientation === 'landscape' ? '1920px' : '1080px', 
          height: orientation === 'landscape' ? '1080px' : 'auto',
          backgroundColor: currentTemplate.bgColor,
          backgroundImage: currentTemplate.bgImage,
          minHeight: orientation === 'landscape' ? '1080px' : '100vh',
          color: currentTemplate.textColor
        }}
      >
        {/* Landscape Left Side: Info */}
        {orientation === 'landscape' && (
          <div className="w-1/3 h-full flex flex-col justify-between py-4">
            <div 
              className="flex flex-col gap-2 pb-8"
              style={{ 
                borderBottom: `4px solid ${currentTemplate.textColor}`,
                borderColor: currentTemplate.id === 'midnight' ? '#374151' : currentTemplate.id === 'cream' ? '#78350F' : '#000000',
              }}
            >
              <h1 
                className="text-9xl font-black tracking-tighter uppercase leading-none"
                style={{ color: currentTemplate.textColor }}
              >
                {format(currentDate, 'MMM')}
              </h1>
              <h2 
                className="text-7xl font-light"
                style={{ color: currentTemplate.accentColor }}
              >
                {format(currentDate, 'yyyy')}
              </h2>
            </div>
            
            <div className="mt-auto">
               <div 
                  className="flex items-center gap-4 mb-8 opacity-60 font-medium tracking-[0.3em] text-xl"
                  style={{ color: currentTemplate.id === 'midnight' ? '#4B5563' : '#9CA3AF' }}
                >
                  <span>COLLECT</span>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentTemplate.id === 'midnight' ? '#4B5563' : '#9CA3AF' }}></span>
                  <span>MEMORIES</span>
                </div>
                
                {currentTemplate.showFooter && (
                  <div 
                    className="pt-8 flex justify-between items-center"
                    style={{ 
                      borderTop: `2px solid ${currentTemplate.accentColor}`,
                      borderColor: currentTemplate.id === 'midnight' ? '#374151' : '#F3F4F6',
                      color: currentTemplate.accentColor
                    }}
                  >
                      <div className="flex flex-col">
                        <span className="text-3xl font-bold tracking-tight" style={{ color: currentTemplate.textColor }}>Monthly Moments</span>
                        <span className="text-lg tracking-wider uppercase mt-1">Photo Calendar Collection</span>
                      </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Main Card / Grid Container */}
        <div 
          className={`
            ${orientation === 'landscape' ? 'h-full flex-1' : 'w-full flex-1'} 
            flex flex-col rounded-[40px] overflow-hidden p-10 transition-all duration-300 shadow-2xl
          `}
          style={{ 
            backgroundColor: currentTemplate.cardBg,
            border: currentTemplate.cardBorder || 'none',
            boxShadow: currentTemplate.id === 'midnight' ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(0, 0, 0, 0.15)'
          }}
        >
          {/* Portrait Header */}
          {orientation === 'portrait' && (
            <div 
              className="flex justify-between items-baseline mb-6 pb-4"
              style={{ 
                borderBottom: `3px solid ${currentTemplate.textColor}`,
                borderColor: currentTemplate.id === 'midnight' ? '#374151' : currentTemplate.id === 'cream' ? '#78350F' : '#000000',
                textShadow: 'none'
              }}
            >
                <h1 
                  className="text-7xl font-black tracking-tighter uppercase"
                  style={{ 
                    color: currentTemplate.textColor,
                    textShadow: 'none'
                  }}
                >
                  {format(currentDate, 'MMM')}
                </h1>
                <h2 
                  className="text-5xl font-light"
                  style={{ 
                    color: currentTemplate.accentColor,
                    textShadow: 'none'
                  }}
                >
                  {format(currentDate, 'yyyy')}
                </h2>
            </div>
          )}

          {/* Grid Headers */}
          <div className="grid grid-cols-7 gap-3 mb-3">
            {weekDays.map(day => (
              <div 
                key={day} 
                className="text-center text-lg font-bold uppercase tracking-widest"
                style={{ 
                  color: currentTemplate.accentColor,
                  textShadow: 'none'
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid Content - Flex-1 to take up remaining space */}
          <div className="grid grid-cols-7 gap-3 flex-1">
            {days.map((day, index) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const photoBlob = photosMap.get(dateStr);
              
              return (
                <div 
                  key={`export-${dateStr}`}
                  className="h-full min-h-[100px]" // Adapted min-height
                >
                  <PhotoCell
                    date={day}
                    currentMonth={currentDate}
                    photoBlob={photoBlob}
                    onUpload={() => {}} 
                    isShareMode={true}
                    // Pass template specific props if needed, or rely on parent styles
                  />
                </div>
              );
            })}
          </div>
          
          {/* Portrait Footer in Card */}
          {orientation === 'portrait' && currentTemplate.showFooter && (
            <div 
              className="mt-8 pt-6 flex justify-between items-center"
              style={{ 
                borderTop: `2px solid ${currentTemplate.accentColor}`,
                borderColor: currentTemplate.id === 'midnight' ? '#374151' : '#F3F4F6',
                color: currentTemplate.accentColor
              }}
            >
                <div className="flex flex-col">
                  <span className="text-xl font-bold tracking-tight" style={{ color: currentTemplate.textColor, textShadow: 'none' }}>Monthly Moments</span>
                  <span className="text-xs tracking-wider uppercase mt-1">Photo Calendar Collection</span>
                </div>
                <div 
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: currentTemplate.id === 'midnight' ? '#374151' : '#F3F4F6' }}
                >
                  <CalendarIcon size={20} style={{ color: currentTemplate.accentColor }} />
                </div>
            </div>
          )}
        </div>

        {/* Portrait Poster Footer */}
        {orientation === 'portrait' && (
          <div 
            className="mt-10 font-medium tracking-[0.5em] text-lg flex items-center gap-4 opacity-60"
            style={{ color: currentTemplate.id === 'midnight' ? '#4B5563' : '#9CA3AF' }}
          >
            <span>COLLECT</span>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTemplate.id === 'midnight' ? '#4B5563' : '#9CA3AF' }}></span>
            <span>YOUR</span>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTemplate.id === 'midnight' ? '#4B5563' : '#9CA3AF' }}></span>
            <span>MEMORIES</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Calendar;
