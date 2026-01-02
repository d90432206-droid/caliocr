
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeInstrument } from '../services/apiService';


interface Props {
  mode: 'identity' | 'reading';
  type?: string;
  onReadingConfirm?: (value: string, unit: string, timestamp: string, image: string) => void;
  onIdentityConfirm?: (data: { maker: string; model: string; serial_number: string, image?: string }) => void;
  onBack: () => void;
  currentIndex?: number;
  totalIndex?: number;
  lockedStandard?: { value: string, unit: string, image: string };
  onUnlock?: () => void;
  isCapturingStandard?: boolean;
  expectedUnit?: string;
  unitOptions?: string[];
}

const InstrumentCapture: React.FC<Props> = ({
  mode, type, onReadingConfirm, onIdentityConfirm, onBack, currentIndex, totalIndex, lockedStandard, onUnlock, isCapturingStandard, expectedUnit, unitOptions
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCaptured, setIsCaptured] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 編輯表單狀態
  const [formData, setFormData] = useState({
    value: '', unit: '', maker: '', model: '', serial_number: ''
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      setStream(newStream);
      if (videoRef.current) videoRef.current.srcObject = newStream;
    } catch (err) {
      alert("相機存取失敗，請確認是否為 HTTPS 環境並授權相機。");
    }
  }, []);

  useEffect(() => {
    if (lockedStandard) {
      setCapturedImage(lockedStandard.image);
      setIsCaptured(true);
      setFormData(prev => ({ ...prev, value: lockedStandard.value, unit: lockedStandard.unit }));
      return;
    }
    startCamera();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [startCamera, lockedStandard]);

  const handleCapture = async (isManual = false) => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        // 1. 計算裁切區域 (Green Box: 80% width, 5/3 aspect ratio)
        // 假設視訊畫面是滿版置中 (object-cover)，我們取視訊源的中央區域進行裁切
        const cropWidth = videoRef.current.videoWidth * 0.8;
        const cropHeight = cropWidth * (3 / 5); // Aspect Ratio 5:3
        const sx = (videoRef.current.videoWidth - cropWidth) / 2;
        const sy = (videoRef.current.videoHeight - cropHeight) / 2;

        // 2. 設定目標尺寸 (Max Width 800px)
        const MAX_WIDTH = 800;
        let destWidth = cropWidth;
        let destHeight = cropHeight;

        if (destWidth > MAX_WIDTH) {
          const scale = MAX_WIDTH / destWidth;
          destWidth = MAX_WIDTH;
          destHeight = destHeight * scale;
        }

        canvas.width = destWidth;
        canvas.height = destHeight;

        // 3. 執行裁切與縮放繪製
        context.drawImage(
          videoRef.current,
          sx, sy, cropWidth, cropHeight, // Source: Crop Area
          0, 0, destWidth, destHeight    // Destination: Resized Area
        );

        const quality = isManual ? 0.6 : 0.9;
        const imgData = canvas.toDataURL('image/jpeg', quality);

        if (imgData.length < 100) {
          alert("拍照失敗，請重新嘗試");
          return;
        }
        setCapturedImage(imgData);
        setIsCaptured(true);
        stream?.getTracks().forEach(t => t.stop());

        // 如果是手動模式，直接跳過 AI
        if (isManual) {
          // 在手動模式下，自動填入預期單位
          setFormData(prev => ({ ...prev, unit: expectedUnit || '' }));
          return;
        }

        // 觸發 AI 辨識 (透過 API 或直接 SDK)
        setIsProcessing(true);
        try {
          const res = await analyzeInstrument(imgData, mode, type);
          if (res.error) {
            alert(res.message || " AI 辨識發生異常");
            setIsCaptured(false);
            startCamera();
            return;
          }
          setFormData({
            value: res.value || '',
            unit: res.unit || expectedUnit || '', // 若 AI 無回傳單位，使用預期單位
            maker: res.maker || '',
            model: res.model || '',
            serial_number: res.serial_number || ''
          });
        } catch (e) {
          console.error("辨識異常，請手動輸入");
          // 錯誤時也嘗試帶入單位
          setFormData(prev => ({ ...prev, unit: expectedUnit || '' }));
        } finally {
          setIsProcessing(false);
        }
      }
    }
  };

  const handleFinalConfirm = () => {
    if (mode === 'reading' && onReadingConfirm && capturedImage) {
      onReadingConfirm(formData.value, formData.unit, new Date().toISOString(), capturedImage);
    } else if (mode === 'identity' && onIdentityConfirm) {
      onIdentityConfirm({
        maker: formData.maker,
        model: formData.model,
        serial_number: formData.serial_number,
        image: capturedImage || undefined
      });
    }
  };

  return (
    <div className="flex-grow flex flex-col bg-slate-950 relative overflow-hidden">
      {/* 工具列 */}
      <div className="absolute top-0 left-0 right-0 z-40 p-5 pt-[calc(1.25rem+safe-area-inset-top)] flex justify-between items-center">
        <button onClick={onBack} className="w-10 h-10 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/10">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        </button>

        <div className="flex flex-col items-end gap-1">
          <div className="px-4 py-1.5 bg-emerald-500 rounded-full text-black text-[10px] font-black tracking-widest uppercase shadow-[0_0_15px_rgba(16,185,129,0.5)]">
            {mode === 'identity' ? '銘牌辨識' : (isCapturingStandard ? '捕獲標準件 (Master Instrument)' : ` LCD 辨識 (${type})`)}
          </div>
          {currentIndex && totalIndex && !isCapturingStandard && (
            <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-lg text-white text-[9px] font-bold border border-white/20">
              待校件進度 PROGRESS: {currentIndex} / {totalIndex}
            </div>
          )}
        </div>
      </div>

      {!isCaptured ? (
        <div className="relative flex-grow">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {/* LCD 掃描導引框 - 使用遮罩層讓視覺更清晰 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-full absolute bg-black/40" style={{ clipPath: 'polygon(0% 0%, 0% 100%, 10% 100%, 10% 35%, 90% 35%, 90% 65%, 10% 65%, 10% 100%, 100% 100%, 100% 0%)' }}></div>
            <div className="w-[80%] aspect-[5/3] border-2 border-emerald-500/30 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
              <div className="absolute inset-0 border border-emerald-500/50 rounded-3xl animate-pulse"></div>
              {/* 四角加強視覺 */}
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl text-emerald-500"></div>
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl"></div>
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl"></div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl"></div>

              {/* 掃描線動畫 */}
              <div className="absolute inset-x-4 h-0.5 bg-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-[scan_2s_infinite]"></div>
            </div>
          </div>
          {/* 拍照快門 */}
          <div className="absolute bottom-16 left-0 right-0 flex flex-col items-center gap-6 pb-[safe-area-inset-bottom]">
            {mode === 'identity' && (
              <button
                onClick={() => handleCapture(true)}
                className="px-6 py-2.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full text-white text-[10px] font-black tracking-widest uppercase active:scale-95 transition-all"
              >
                直接拍照手動輸入 (SKIP AI)
              </button>
            )}
            <button onClick={() => handleCapture(false)} className="w-20 h-20 rounded-full border-4 border-white/20 p-1 bg-white/10 backdrop-blur-md active:scale-95 transition-all">
              <div className="w-full h-full rounded-full bg-white shadow-[0_0_25px_rgba(255,255,255,0.7)] hover:scale-105 transition-transform"></div>
            </button>
          </div>

          <style dangerouslySetInnerHTML={{
            __html: `
            @keyframes scan {
              0%, 100% { top: 10%; opacity: 0; }
              10% { opacity: 1; }
              50% { top: 90%; opacity: 1; }
              90% { opacity: 1; }
              95% { opacity: 0; }
            }
          `}} />
        </div >
      ) : (
        <div className="flex-grow flex flex-col bg-slate-900 animate-in slide-in-from-bottom-5">
          {/* 截圖預覽 */}
          <div className="h-1/3 relative bg-black">
            <img src={capturedImage!} className="w-full h-full object-contain" />
            {isProcessing && (
              <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-sm flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="mt-4 text-emerald-500 font-black text-xs tracking-widest animate-pulse">PYTHON + AI 處理中...</div>
              </div>
            )}
          </div>

          {/* 編輯區 */}
          <div className="flex-grow p-6 overflow-y-auto">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
              <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">
                {isCapturingStandard ? '編輯標準件紀錄' : '編輯待校件紀錄'}
              </span>
            </div>

            {mode === 'reading' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold">辨識數值</label>
                  <input
                    type="text"
                    value={formData.value}
                    onChange={e => setFormData({ ...formData, value: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-3xl font-black text-emerald-400 outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold">單位</label>
                  {unitOptions && unitOptions.length > 0 ? (
                    <div className="relative">
                      <select
                        value={formData.unit}
                        onChange={e => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xl font-bold text-slate-300 outline-none focus:border-emerald-500 appearance-none"
                      >
                        {formData.unit && !unitOptions.includes(formData.unit) && <option value={formData.unit}>{formData.unit}</option>}
                        {unitOptions.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={e => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xl font-bold text-slate-300 outline-none focus:border-emerald-500"
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 font-bold">廠牌 Maker</label>
                    <input type="text" value={formData.maker} onChange={e => setFormData({ ...formData, maker: e.target.value })} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 font-bold">型號 Model</label>
                    <input type="text" value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold outline-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold">序號 Serial No.</label>
                  <input type="text" value={formData.serial_number} onChange={e => setFormData({ ...formData, serial_number: e.target.value })} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold outline-none tracking-widest" />
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-10 pb-10">
              {lockedStandard && onUnlock ? (
                <button onClick={onUnlock} className="flex-1 py-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold rounded-2xl">重設標準件</button>
              ) : (
                <button onClick={() => { setIsCaptured(false); startCamera(); }} className="flex-1 py-4 bg-slate-800 text-white font-bold rounded-2xl">重拍</button>
              )}
              <button onClick={handleFinalConfirm} disabled={isProcessing} className="flex-[2] py-4 bg-emerald-500 text-black font-black rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">
                {lockedStandard ? '沿用標準紀錄' : '確認紀錄'}
              </button>
            </div>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div >
  );
};

export default InstrumentCapture;
