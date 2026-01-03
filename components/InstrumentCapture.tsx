
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeInstrument } from '../services/apiService';


interface Props {
  mode: 'identity' | 'reading';
  type?: string;
  onReadingConfirm?: (stdValue: string, dutValue: string, unit: string, timestamp: string, dutImage: string, stdImage: string, stdInfo?: { maker: string; model: string; serial: string; categories?: string[]; reports?: Array<{ report_no: string; expiry_date: string }> }) => void;
  onIdentityConfirm?: (data: { maker: string; model: string; serial_number: string; categories?: string[]; reports?: Array<{ report_no: string; expiry_date: string }>; image?: string }) => void;
  onBack: () => void;
  currentIndex?: number;
  totalIndex?: number;
  lockedStandard?: { value: string, unit: string, image: string, maker?: string, model?: string, serial?: string };
  onUnlock?: () => void;
  isCapturingStandard?: boolean;
  expectedUnit?: string;
  unitOptions?: string[];
  availableStandards?: Array<{ id: string; maker: string; model: string; serial: string; image?: string }>;
  activeStandardInfo?: { maker: string; model: string; serial: string };
}

const InstrumentCapture: React.FC<Props> = ({
  mode, type, onReadingConfirm, onIdentityConfirm, onBack, currentIndex, totalIndex, lockedStandard, onUnlock, isCapturingStandard, expectedUnit, unitOptions, availableStandards, activeStandardInfo
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCaptured, setIsCaptured] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null); // This acts as the "current" or "DUT" image
  const [stdCapturedImage, setStdCapturedImage] = useState<string | null>(null); // For Standard instrument display
  const [captureStage, setCaptureStage] = useState<'STANDARD' | 'DUT'>('DUT'); // Default to DUT, but can switch
  const [isProcessing, setIsProcessing] = useState(false);

  // 編輯表單狀態
  const [formData, setFormData] = useState({
    std_value: '', value: '', unit: '', maker: '', model: '', serial_number: '',
    categories: [] as string[], reports: [{ report_no: '', expiry_date: '' }]
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
      setStdCapturedImage(lockedStandard.image);
      setFormData(prev => ({
        ...prev,
        std_value: lockedStandard.value,
        unit: lockedStandard.unit || prev.unit,
        maker: lockedStandard.maker || prev.maker,
        model: lockedStandard.model || prev.model,
        serial_number: lockedStandard.serial || prev.serial_number
      }));
      // If we are just capturing identity or a fresh standard, we might still want to skip.
      // But in reading mode, we ALWAYS want to capture the DUT photo.
      if (mode === 'identity') {
        setCapturedImage(lockedStandard.image);
        setIsCaptured(true);
        return;
      }
      // Continue to start camera for DUT capture
    }
    startCamera();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [startCamera, lockedStandard, mode]);

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
        if (captureStage === 'STANDARD') {
          setStdCapturedImage(imgData);
        } else {
          setCapturedImage(imgData);
        }
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
          setFormData(prev => ({
            ...prev,
            std_value: captureStage === 'STANDARD' ? (res.value || prev.std_value) : prev.std_value,
            value: captureStage === 'DUT' ? (res.value || prev.value) : prev.value,
            unit: res.unit || expectedUnit || prev.unit,
            maker: res.maker || prev.maker,
            model: res.model || prev.model,
            serial_number: res.serial_number || prev.serial_number
          }));
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

  const handleRetake = () => {
    setIsCaptured(false);
    startCamera();
  };

  const switchToStandard = () => {
    setCaptureStage('STANDARD');
    setIsCaptured(false);
    startCamera();
  };

  const switchToDUT = () => {
    setCaptureStage('DUT');
    setIsCaptured(false);
    startCamera();
  };

  const handleFinalConfirm = () => {
    if (mode === 'reading' && onReadingConfirm) {
      onReadingConfirm(
        formData.std_value || formData.value,
        formData.value,
        formData.unit,
        new Date().toISOString(),
        capturedImage || '',
        stdCapturedImage || capturedImage || '',
        isCapturingStandard ? {
          maker: formData.maker,
          model: formData.model,
          serial: formData.serial_number,
          categories: formData.categories,
          reports: formData.reports.filter(r => r.report_no || r.expiry_date)
        } : undefined
      );
    } else if (mode === 'identity' && onIdentityConfirm) {
      onIdentityConfirm({
        maker: formData.maker,
        model: formData.model,
        serial_number: formData.serial_number,
        categories: formData.categories,
        reports: formData.reports.filter(r => r.report_no || r.expiry_date),
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
            {mode === 'identity' ? '銘牌辨識' : (isCapturingStandard ? '捕獲標準件 (Master Instrument)' : ` LCD 辨識 (${type}) - ${captureStage === 'STANDARD' ? '標準器' : '待校件'}`)}
          </div>
          {currentIndex && totalIndex && !isCapturingStandard && (
            <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-lg text-white text-[9px] font-bold border border-white/20">
              待校件進度 DUT PROGRESS: {currentIndex} / {totalIndex}
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
        <div className="flex-grow flex flex-col bg-slate-900 animate-in slide-in-from-bottom-5 overflow-y-auto pb-20">
          {/* 截圖預覽 */}
          <div className="h-1/3 relative bg-black flex-none flex overflow-hidden">
            <div className={`relative flex-grow h-full transition-all duration-300 ${captureStage === 'DUT' ? 'w-full' : 'w-1/2 opacity-50'}`}>
              <img src={capturedImage!} className="w-full h-full object-contain" />
              <div className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500 rounded text-[8px] font-black text-black">DUT PHOTO</div>
              <button
                onClick={switchToDUT}
                className="absolute inset-0 bg-transparent"
              />
            </div>
            {stdCapturedImage && (
              <div className={`relative flex-grow h-full border-l border-white/20 transition-all duration-300 ${captureStage === 'STANDARD' ? 'w-full' : 'w-1/2 opacity-50'}`}>
                <img src={stdCapturedImage} className="w-full h-full object-contain" />
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-blue-500 rounded text-[8px] font-black text-white">STD PHOTO</div>
                <button
                  onClick={switchToStandard}
                  className="absolute inset-0 bg-transparent"
                />
              </div>
            )}
            {!stdCapturedImage && mode === 'reading' && (
              <button
                onClick={switchToStandard}
                className="flex-none w-1/4 bg-slate-800 flex flex-col items-center justify-center gap-1 border-l border-slate-700"
              >
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="text-[8px] font-black text-blue-500 uppercase">ADD STD photo</span>
              </button>
            )}
            {isProcessing && (
              <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="mt-4 text-emerald-500 font-black text-xs tracking-widest animate-pulse">PYTHON + AI 處理中...</div>
              </div>
            )}
          </div>

          {/* 編輯區 */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
              <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">
                {isCapturingStandard ? '編輯標準件紀錄' : '編輯待校件紀錄'}
              </span>
            </div>

            {mode === 'reading' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4 col-span-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] text-blue-500 font-black uppercase tracking-widest">標準器讀數 Standard Value</label>
                      <input
                        type="text"
                        value={formData.std_value}
                        onChange={e => setFormData({ ...formData, std_value: e.target.value })}
                        placeholder="Standard"
                        className="w-full bg-slate-950 border border-blue-500/30 p-4 rounded-2xl text-2xl font-black text-blue-400 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">待校件讀數 DUT Value</label>
                      <input
                        type="text"
                        value={formData.value}
                        onChange={e => setFormData({ ...formData, value: e.target.value })}
                        placeholder="DUT"
                        className="w-full bg-slate-950 border border-emerald-500/30 p-4 rounded-2xl text-2xl font-black text-emerald-400 outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] text-slate-500 font-bold">單位 Unit</label>
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

                {/* Show Active Standard for DUT Readings */}
                {!isCapturingStandard && activeStandardInfo && (
                  <div className="mt-6 pt-4 border-t border-slate-800 animate-in slide-in-from-bottom-2 col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">目前關聯標準件 CURRENT STANDARD</span>
                    </div>
                    <div className="bg-blue-500/5 border border-blue-500/20 p-3 rounded-xl">
                      <div className="text-white font-black italic text-xs">{activeStandardInfo.maker}</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">{activeStandardInfo.model} | {activeStandardInfo.serial}</div>
                    </div>
                  </div>
                )}

                {/* Standard Info Selection/Inputs */}
                {isCapturingStandard && (
                  <div className="mt-6 pt-6 border-t border-slate-800 space-y-4 animate-in slide-in-from-bottom-2 col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">標準件資訊 Standard Info</span>
                      </div>

                      {availableStandards && availableStandards.length > 0 && (
                        <select
                          className="bg-slate-800 text-[9px] font-bold text-emerald-400 px-3 py-1 rounded-lg border border-emerald-500/30 outline-none"
                          onChange={(e) => {
                            const std = availableStandards.find(s => s.id === e.target.value);
                            if (std) {
                              setFormData(prev => ({ ...prev, maker: std.maker, model: std.model, serial_number: std.serial }));
                            }
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>快速選擇已建立標準件...</option>
                          {availableStandards.map(s => (
                            <option key={s.id} value={s.id}>{s.maker} ({s.model} - {s.serial})</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 font-bold">廠牌 Maker</label>
                        <input type="text" value={formData.maker} onChange={e => setFormData({ ...formData, maker: e.target.value })} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-slate-300 outline-none focus:border-emerald-500" placeholder="e.g. Fluke" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 font-bold">型號 Model</label>
                        <input type="text" value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-slate-300 outline-none focus:border-emerald-500" placeholder="e.g. 5522A" />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <label className="text-[10px] text-slate-500 font-bold">序號 Serial No.</label>
                        <input type="text" value={formData.serial_number} onChange={e => setFormData({ ...formData, serial_number: e.target.value })} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-slate-300 outline-none tracking-widest focus:border-emerald-500" />
                      </div>
                      <div className="space-y-4 col-span-2">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pl-1">校正報告及其有效期 Calibration Reports</label>
                        {formData.reports.map((report, rIdx) => (
                          <div key={rIdx} className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 animate-in slide-in-from-top-2">
                            <div className="md:col-span-3 space-y-1">
                              <label className="text-[9px] font-bold text-slate-600 uppercase">報告編號 Report No.</label>
                              <input
                                value={report.report_no}
                                onChange={e => {
                                  const rs = [...formData.reports];
                                  rs[rIdx].report_no = e.target.value;
                                  setFormData({ ...formData, reports: rs });
                                }}
                                className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl outline-none focus:border-emerald-500 text-xs font-black text-white"
                                placeholder="R2024-001"
                              />
                            </div>
                            <div className="md:col-span-3 space-y-1">
                              <label className="text-[9px] font-bold text-slate-600 uppercase">有效日期 Expiry Date</label>
                              <input
                                type="date"
                                value={report.expiry_date}
                                onChange={e => {
                                  const rs = [...formData.reports];
                                  rs[rIdx].expiry_date = e.target.value;
                                  setFormData({ ...formData, reports: rs });
                                }}
                                className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl outline-none focus:border-emerald-500 text-xs font-black text-white"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (formData.reports.length === 1) return;
                                setFormData({ ...formData, reports: formData.reports.filter((_, i) => i !== rIdx) });
                              }}
                              className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl disabled:opacity-30 transition-all flex justify-center"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, reports: [...formData.reports, { report_no: '', expiry_date: '' }] })}
                          className="w-full py-3 border border-dashed border-emerald-500/30 text-emerald-500 text-[10px] font-black rounded-xl hover:bg-emerald-500/5 transition-all uppercase"
                        >
                          + 新增一份報告
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
                {/* Identity mode extra fields */}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold">量別 Categories (逗號分隔)</label>
                  <input
                    type="text"
                    value={formData.categories.join(', ')}
                    onChange={e => setFormData({ ...formData, categories: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold outline-none text-slate-300"
                    placeholder="e.g. DCA, DCV"
                  />
                </div>
                <div className="space-y-4 pt-4 border-t border-slate-800/50">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pl-1">校正報告 Calibration Reports</label>
                  {formData.reports.map((report, rIdx) => (
                    <div key={rIdx} className="grid grid-cols-2 gap-3 items-center">
                      <input
                        value={report.report_no}
                        onChange={e => {
                          const rs = [...formData.reports];
                          rs[rIdx].report_no = e.target.value;
                          setFormData({ ...formData, reports: rs });
                        }}
                        className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs font-black text-white"
                        placeholder="Report No."
                      />
                      <input
                        type="date"
                        value={report.expiry_date}
                        onChange={e => {
                          const rs = [...formData.reports];
                          rs[rIdx].expiry_date = e.target.value;
                          setFormData({ ...formData, reports: rs });
                        }}
                        className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs font-black text-white"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, reports: [...formData.reports, { report_no: '', expiry_date: '' }] })}
                    className="w-full py-2.5 border border-dashed border-slate-700 text-slate-500 text-[10px] font-bold rounded-xl hover:text-emerald-500 transition-all"
                  >
                    + 新增報告
                  </button>
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
