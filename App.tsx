
import React, { useState } from 'react';
import CalibrationForm from './components/CalibrationForm';
import CategorySelector from './components/CategorySelector';
import InstrumentCapture from './components/InstrumentCapture';
import CalibrationHistory from './components/CalibrationHistory';
import EquipmentList from './components/EquipmentList';
import PreSetup from './components/PreSetup';
import { saveCalibrationRecord, CalibrationRecord, getQuotationTemplate } from './services/supabaseService';


type AppStep =
  | 'QUOTATION_ENTRY'
  | 'STANDARD_SETUP'
  | 'STANDARD_CAPTURE'
  | 'EQUIPMENT_LIST'
  | 'IDENTITY_CAPTURE'
  | 'ITEM_DASHBOARD'
  | 'TYPE_LIST'
  | 'POINT_LIST'
  | 'READING_CAPTURE'
  | 'SUCCESS'
  | 'EDIT_IDENTITY'
  | 'EDIT_READING'
  | 'HISTORY_VIEW'
  | 'IDENTITY_MANUAL'
  | 'PRE_SETUP';

interface StandardInstrument {
  id: string;
  maker: string;
  model: string;
  serial: string;
  image?: string;
}

interface SessionData {
  customer_name: string;
  quotation_no: string;
  temperature: string;
  humidity: string;
  items: EquipmentItem[];
  standards: StandardInstrument[];
  standardCache: Record<string, { value: string, unit: string, image: string, maker?: string, model?: string, serial?: string }>;
}

interface ReadingData {
  id: string;
  image: string;
  value: string;
  unit: string;
  timestamp: string;
  seq: number;
  maker?: string;
  model?: string;
  serial?: string;
}

interface CalibrationPoint {
  id: string;
  targetValue: string;
  unit: string;
  frequency?: string;
  std_maker?: string;
  std_model?: string;
  std_serial?: string;
  standard: ReadingData | null;
  readings: ReadingData[];
}

interface MeasurementType {
  id: string;
  type: string;
  maxReadings: number;
  points: CalibrationPoint[];
}

interface EquipmentItem {
  id: string;
  equipment_id: string;
  identity: { maker: string; model: string; serial_number: string; image?: string };
  measurementTypes: MeasurementType[];
}

export const CATEGORY_LABELS: Record<string, string> = {
  dc_voltage: '直流電壓 DCV',
  dc_current: '直流電流 DCA',
  ac_voltage: '交流電壓 ACV',
  ac_current: '交流電流 ACA',
  resistance: '電阻 Resistance',
  power: '電功率 Power',
  temperature: '溫度記錄 Temp',
  pressure: '壓力數值 Press',
  diff_pressure: '差壓 Diff Press',
  digital_pressure: '數字壓力計 Digital'
};

export const UNIT_OPTIONS: Record<string, string[]> = {
  dc_voltage: ['mV', 'V', 'kV'],
  dc_current: ['μA', 'mA', 'A'],
  ac_voltage: ['mV', 'V', 'kV'],
  ac_current: ['μA', 'mA', 'A'],
  resistance: ['mΩ', 'Ω', 'kΩ', 'MΩ'],
  power: ['mW', 'W', 'kW'],
  temperature: ['℃', 'Ω'],
  pressure: ['Pa', 'kPa', 'MPa'],
  diff_pressure: ['Pa', 'kPa', 'MPa'],
  digital_pressure: ['Pa', 'kPa', 'MPa']
};

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('QUOTATION_ENTRY');
  const [session, setSession] = useState<SessionData>({
    quotation_no: localStorage.getItem('quotation_no') || '',
    customer_name: localStorage.getItem('customer_name') || '',
    temperature: localStorage.getItem('env_temperature') || '',
    humidity: localStorage.getItem('env_humidity') || '',
    items: [] as EquipmentItem[],
    standards: [] as StandardInstrument[],
    standardCache: {} as Record<string, { value: string, unit: string, image: string, maker?: string, model?: string, serial?: string }>
  });

  // Persist session to localStorage
  React.useEffect(() => {
    if (session.quotation_no) localStorage.setItem('quotation_no', session.quotation_no);
    if (session.customer_name) localStorage.setItem('customer_name', session.customer_name);
    if (session.temperature) localStorage.setItem('env_temperature', session.temperature);
    if (session.humidity) localStorage.setItem('env_humidity', session.humidity);
  }, [session.quotation_no, session.customer_name, session.temperature, session.humidity]);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeTypeId, setActiveTypeId] = useState<string | null>(null);
  const [activePointId, setActivePointId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // New state for adding point modal
  const [isAddingPoint, setIsAddingPoint] = useState(false);

  const [newPointVal, setNewPointVal] = useState('');
  const [newPointUnit, setNewPointUnit] = useState('');
  const [newPointFreq, setNewPointFreq] = useState('');

  const activeItem = session.items.find(i => i.id === activeItemId);
  const activeType = activeItem?.measurementTypes.find(t => t.id === activeTypeId);
  const activePoint = activeType?.points.find(p => p.id === activePointId);

  const handleQuotationSubmit = async (data: { customer_name: string, quotation_no: string, temperature: string, humidity: string }) => {
    setIsSyncing(true);
    try {
      const template = await getQuotationTemplate(data.quotation_no);
      if (template) {
        setSession(prev => ({
          ...prev,
          quotation_no: template.quotation_no,
          customer_name: template.customer_name,
          temperature: data.temperature,
          humidity: data.humidity,
          items: template.items.map((it: any) => ({
            ...it,
            identity: { maker: it.maker, model: it.model, serial_number: it.serial_number }
          }))
        }));
      } else {
        setSession(prev => ({
          ...prev,
          quotation_no: data.quotation_no,
          customer_name: data.customer_name,
          temperature: data.temperature,
          humidity: data.humidity
        }));
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setIsSyncing(false);
      setStep('STANDARD_SETUP');
    }
  };

  const clearSession = () => {
    setSession({
      quotation_no: '',
      customer_name: '',
      temperature: '',
      humidity: '',
      items: [],
      standards: [],
      standardCache: {}
    });
    localStorage.removeItem('quotation_no');
    localStorage.removeItem('customer_name');
    localStorage.removeItem('env_temperature');
    localStorage.removeItem('env_humidity');
    setStep('QUOTATION_ENTRY');
  };

  const addStandard = (std: { maker: string; model: string; serial_number: string; categories?: string; calibration_expiry?: string; report_no?: string; image?: string }) => {
    setSession(prev => ({
      ...prev,
      standards: [
        ...prev.standards,
        {
          id: crypto.randomUUID(),
          maker: std.maker,
          model: std.model,
          serial: std.serial_number,
          categories: std.categories,
          calibration_expiry: std.calibration_expiry,
          report_no: std.report_no,
          image: std.image
        }
      ]
    }));
    setStep('STANDARD_SETUP');
  };

  const startNewItem = () => {
    setStep('IDENTITY_CAPTURE');
  };

  const handleIdentityComplete = (idData: { maker: string, model: string, serial_number: string, image?: string, equipment_id?: string }) => {
    const newItem: EquipmentItem = {
      id: crypto.randomUUID(),
      equipment_id: idData.equipment_id || `EQ-${Date.now()}`,
      identity: { maker: idData.maker, model: idData.model, serial_number: idData.serial_number, image: idData.image },
      measurementTypes: []
    };
    setSession(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
    setActiveItemId(newItem.id);
    setStep('ITEM_DASHBOARD');
  };

  const addMeasurementType = (type: string, maxReadings: number) => {
    if (!activeItemId) return;
    const newTypeId = crypto.randomUUID();
    const newType: MeasurementType = { id: newTypeId, type, maxReadings, points: [] };

    setSession(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === activeItemId
          ? { ...item, measurementTypes: [...item.measurementTypes, newType] }
          : item
      )
    }));
    setActiveTypeId(newTypeId);
    setStep('POINT_LIST');
  };

  const addPointToType = (targetValue: string, unit: string, frequency?: string) => {
    if (!activeItemId || !activeTypeId) return;
    const newPointId = crypto.randomUUID();
    const newPoint: CalibrationPoint = { id: newPointId, targetValue, unit, frequency, standard: null, readings: [] };

    setSession(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id !== activeItemId) return item;
        return {
          ...item,
          measurementTypes: item.measurementTypes.map(t =>
            t.id === activeTypeId ? { ...t, points: [...t.points, newPoint] } : t
          )
        };
      })
    }));
  };

  // Handle Reading Capture (Standard or DUT)
  // Updated signature to accept standard info
  const handleReadingCapture = (stdValue: string, dutValue: string, unit: string, timestamp: string, image: string, stdInfo?: { maker: string, model: string, serial: string }) => {
    if (!activeItem || !activeType || !activePoint) return;

    let shouldGoBack = false;

    setSession(prev => {
      const newItems = prev.items.map(item => {
        if (item.id !== activeItemId) return item;
        return {
          ...item,
          measurementTypes: item.measurementTypes.map(t => {
            if (t.id !== activeTypeId) return t;
            return {
              ...t,
              points: t.points.map(p => {
                if (p.id !== activePointId) return p;

                const commonData = {
                  id: crypto.randomUUID(),
                  value: dutValue,
                  unit,
                  timestamp,
                  image
                };

                // In the new dual flow, we save both at once
                const standardData = {
                  id: crypto.randomUUID(),
                  value: stdValue,
                  unit,
                  timestamp,
                  image,
                  seq: 0,
                  ...stdInfo
                };

                const newLength = p.readings.length + 1;
                if (newLength >= t.maxReadings) {
                  shouldGoBack = true;
                }

                return {
                  ...p,
                  standard: standardData,
                  readings: [
                    ...p.readings,
                    {
                      ...commonData,
                      seq: newLength,
                      maker: stdInfo?.maker || p.standard?.maker,
                      model: stdInfo?.model || p.standard?.model,
                      serial: stdInfo?.serial || p.standard?.serial
                    }
                  ]
                };
              })
            };
          })
        };
      });

      return { ...prev, items: newItems };
    });

    if (shouldGoBack) {
      setStep('POINT_LIST');
    }
  };

  const unlockStandard = (targetValue: string) => {
    if (!activeType) return;
    setSession(prev => {
      const newCache = { ...prev.standardCache };
      delete newCache[`${activeType.type}_${targetValue}`];
      return { ...prev, standardCache: newCache };
    });
  };

  const handleFinalSubmit = async () => {
    setIsSyncing(true);
    try {
      for (const item of session.items) {
        // 0. 如果有銘牌照片，先儲存一張 "Identity Photo" 紀錄
        if (item.identity.image) {
          await saveCalibrationRecord({
            customer_name: session.customer_name,
            equipment_id: item.equipment_id,
            quotation_no: session.quotation_no,
            maker: item.identity.maker,
            model: item.identity.model,
            serial_number: item.identity.serial_number,
            reading_type: 'Identity Photo',
            standard_value: 'N/A',
            value: 'Nameplate',
            unit: 'Img',
            image_base64: item.identity.image,
            created_at: new Date().toISOString()
          });
        }

        for (const mType of item.measurementTypes) {
          for (const point of mType.points) {
            // Save standard if exists
            if (point.standard) {
              await saveCalibrationRecord({
                quotation_no: session.quotation_no,
                equipment_id: item.equipment_id,
                customer_name: session.customer_name,
                ...item.identity,
                reading_type: `${mType.type}_STANDARD`,
                standard_value: point.targetValue,
                std_maker: point.standard.maker,
                std_model: point.standard.model,
                std_serial: point.standard.serial,
                std_unit: point.standard.unit,
                value: point.standard.value,
                unit: point.standard.unit,
                image_base64: point.standard.image,
                created_at: point.standard.timestamp
              });
            }
            // Save readings
            for (const r of point.readings) {
              await saveCalibrationRecord({
                quotation_no: session.quotation_no,
                equipment_id: item.equipment_id,
                customer_name: session.customer_name,
                ...item.identity,
                reading_type: mType.type,
                standard_value: point.targetValue,
                std_maker: point.standard?.maker,
                std_model: point.standard?.model,
                std_serial: point.standard?.serial,
                std_unit: point.standard?.unit,
                value: r.value,
                unit: r.unit,
                frequency: point.frequency,
                environment_temp: session.temperature,
                environment_humidity: session.humidity,
                image_base64: r.image,
                created_at: r.timestamp
              });
            }
          }
        }
      }
      setStep('SUCCESS');
    } catch (err) {
      alert("提交失敗");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-slate-950 text-slate-100 font-sans select-none overflow-hidden pb-[safe-area-inset-bottom]">
      <header className="flex-none pt-[safe-area-inset-top] h-[calc(3.5rem+safe-area-inset-top)] flex items-center justify-between px-5 bg-slate-900 border-b border-slate-800 z-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs font-black tracking-tighter text-emerald-500 uppercase">Pro-Calib AI v2</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('PRE_SETUP')}
            className="hidden md:flex items-center gap-2 text-[10px] font-black text-amber-500 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20 hover:bg-amber-500/20 transition-all"
          >
            事前作業 Pre-Setup
          </button>
          <button
            onClick={() => setStep('HISTORY_VIEW')}
            className="hidden md:flex items-center gap-2 text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
          >
            歷史記錄查詢
          </button>
          <div className="text-[10px] font-bold text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
            Q: {session.quotation_no || 'NEW'}
          </div>
        </div>
      </header>

      <main className="flex-grow relative overflow-hidden flex flex-col">
        {step === 'QUOTATION_ENTRY' && (
          <CalibrationForm
            onSubmit={handleQuotationSubmit}
            initialData={{
              customer_name: session.customer_name,
              quotation_no: session.quotation_no,
              temperature: session.temperature,
              humidity: session.humidity
            }}
            onReset={clearSession}
          />
        )}

        {step === 'STANDARD_SETUP' && (
          <div className="flex-grow flex flex-col p-8 overflow-y-auto bg-slate-950">
            <div className="flex items-center gap-4 mb-10">
              <button
                onClick={() => setStep('QUOTATION_ENTRY')}
                className="p-3 bg-slate-900 rounded-2xl border border-slate-800 text-slate-500 active:scale-95 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h3 className="font-black text-2xl text-white italic uppercase">標準件管理 STANDARDS</h3>
            </div>

            <div className="space-y-4 mb-10">
              {session.standards.length === 0 ? (
                <div className="py-20 text-center space-y-4 bg-slate-900/30 rounded-[2.5rem] border border-dashed border-slate-800">
                  <div className="text-4xl text-slate-800 font-black italic uppercase ml-1">No Standards</div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest px-10">請先建立本次校正要使用的標準件</p>
                </div>
              ) : (
                session.standards.map(std => (
                  <div key={std.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {std.image && <img src={std.image} className="w-12 h-12 rounded-xl object-cover bg-black" />}
                      <div>
                        <div className="text-white font-black italic">{std.maker} {std.model}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase">{std.serial}</div>
                        <div className="flex gap-2 mt-1">
                          {std.categories && <div className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">{std.categories}</div>}
                          {std.report_no && <div className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">Report: {std.report_no}</div>}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSession(prev => ({ ...prev, standards: prev.standards.filter(s => s.id !== std.id) }))}
                      className="text-rose-500/50 hover:text-rose-500"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col gap-4 mt-auto">
              <button
                onClick={() => setStep('STANDARD_CAPTURE')}
                className="w-full py-6 bg-slate-900 border border-slate-800 text-white font-black rounded-[2rem] active:scale-[0.98] transition-all text-xs uppercase tracking-widest"
              >
                + 新增標準件 (ADD)
              </button>
              <button
                onClick={() => setStep('EQUIPMENT_LIST')}
                className="w-full py-6 bg-emerald-500 text-black font-black rounded-[2rem] shadow-2xl shadow-emerald-500/30 active:scale-[0.98] transition-all text-sm uppercase tracking-widest"
              >
                下一步: 待校件清單 (DUT LIST)
              </button>
            </div>
          </div>
        )}

        {step === 'STANDARD_CAPTURE' && (
          <InstrumentCapture
            mode="identity"
            onIdentityConfirm={addStandard}
            onBack={() => setStep('STANDARD_SETUP')}
          />
        )}

        {step === 'EQUIPMENT_LIST' && (
          <EquipmentList
            items={session.items}
            quotationNo={session.quotation_no}
            onAddItem={startNewItem}
            onSelectItem={(id) => { setActiveItemId(id); setStep('ITEM_DASHBOARD'); }}
            onSubmitAll={handleFinalSubmit}
            isSyncing={isSyncing}
            categoryLabels={CATEGORY_LABELS}
          />
        )}

        {step === 'IDENTITY_CAPTURE' && (
          <InstrumentCapture
            mode="identity"
            onIdentityConfirm={handleIdentityComplete}
            onBack={() => setStep('EQUIPMENT_LIST')}
            onManualInput={() => setStep('IDENTITY_MANUAL')}
          />
        )}

        {step === 'IDENTITY_MANUAL' && (
          <div className="flex-grow p-8 bg-slate-950 flex flex-col overflow-y-auto">
            <div className="flex items-center gap-4 mb-10">
              <button
                onClick={() => setStep('IDENTITY_CAPTURE')}
                className="p-3 bg-slate-900 rounded-2xl border border-slate-800 text-slate-500 active:scale-95 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="font-black text-2xl text-white italic truncate uppercase">手動輸入銘牌資訊</h3>
            </div>

            <div className="space-y-6 flex-grow">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">廠牌 Maker</label>
                <input
                  id="manualMaker"
                  type="text"
                  placeholder="例如: ASUS"
                  className="w-full bg-slate-900 border border-slate-800 p-5 rounded-[1.5rem] text-xl font-black text-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-700"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">型號 Model</label>
                <input
                  id="manualModel"
                  type="text"
                  placeholder="例如: Multimeter X1"
                  className="w-full bg-slate-900 border border-slate-800 p-5 rounded-[1.5rem] text-xl font-black text-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-700"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">序號 Serial No.</label>
                <input
                  id="manualSerial"
                  type="text"
                  placeholder="例如: SN123456"
                  className="w-full bg-slate-900 border border-slate-800 p-5 rounded-[1.5rem] text-lg font-black text-white tracking-widest focus:border-emerald-500 outline-none transition-all placeholder:text-slate-700"
                />
              </div>
            </div>

            <button
              onClick={() => {
                const maker = (document.getElementById('manualMaker') as HTMLInputElement).value || 'Unknown';
                const model = (document.getElementById('manualModel') as HTMLInputElement).value || 'Unknown';
                const serial = (document.getElementById('manualSerial') as HTMLInputElement).value || 'N/A';
                handleIdentityComplete({ maker, model, serial_number: serial });
              }}
              className="mt-10 w-full py-6 bg-emerald-500 text-black font-black rounded-[2rem] shadow-2xl shadow-emerald-500/30 active:scale-[0.98] transition-all text-sm uppercase tracking-widest"
            >
              確認並進行校正
            </button>
          </div>
        )}

        {step === 'PRE_SETUP' && (
          <PreSetup
            onBack={() => setStep('QUOTATION_ENTRY')}
            onStartCalibration={(q) => {
              setSession(prev => ({ ...prev, quotation_no: q }));
              setStep('QUOTATION_ENTRY');
            }}
          />
        )}

        {step === 'ITEM_DASHBOARD' && activeItem && (
          <div className="flex-grow flex flex-col p-6 overflow-y-auto pb-24">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">設備資訊 Device Info</div>
                <button onClick={() => setStep('EQUIPMENT_LIST')} className="text-[10px] text-emerald-400 font-bold border border-emerald-500/20 px-3 py-1 rounded-full uppercase">返回清單</button>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Case ID</div>
                  <div className="text-xl font-black text-white">{activeItem.equipment_id}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Maker</div>
                  <div className="text-lg font-bold text-white">{activeItem.identity.maker || '--'}</div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Model</div>
                    <div className="text-sm font-bold text-white">{activeItem.identity.model || '--'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Serial</div>
                    <div className="text-sm font-bold text-white tracking-widest">{activeItem.identity.serial_number || '--'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-lg italic uppercase tracking-tighter italic">校正量別 ({activeItem.measurementTypes.length})</h3>
              <button
                onClick={() => setStep('TYPE_LIST')}
                className="px-5 py-2.5 bg-emerald-500 text-black text-xs font-black rounded-2xl shadow-lg active:scale-95 transition-all uppercase tracking-widest"
              >
                + 新增量別
              </button>
            </div>

            <div className="space-y-4">
              {activeItem.measurementTypes.length === 0 ? (
                <div className="h-40 border-2 border-dashed border-slate-900 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-700 p-8 text-center">
                  <div className="text-sm font-black mb-1 opacity-50 uppercase tracking-widest">尚未設定量測類別</div>
                </div>
              ) : (
                activeItem.measurementTypes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setActiveTypeId(t.id); setStep('POINT_LIST'); }}
                    className="w-full bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] flex justify-between items-center hover:border-emerald-500/30 transition-all active:scale-[0.98]"
                  >
                    <div>
                      <div className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">
                        {CATEGORY_LABELS[t.type] || t.type}
                      </div>
                      <div className="text-xl font-black text-white italic">{t.points.length} POINTS</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-emerald-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {step === 'TYPE_LIST' && (
          <CategorySelector
            onSelect={(t, count) => addMeasurementType(t, count)}
            onBack={() => setStep('ITEM_DASHBOARD')}
          />
        )}

        {step === 'POINT_LIST' && activeItem && activeType && (
          <div className="flex-grow flex flex-col p-6 overflow-y-auto">
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => setStep('ITEM_DASHBOARD')} className="p-3 bg-slate-900 rounded-[1rem] border border-slate-800 text-slate-500 active:scale-90 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg></button>
              <div>
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">{CATEGORY_LABELS[activeType.type] || activeType.type}</div>
                <h3 className="font-black text-xl text-white uppercase italic tracking-tighter">點位管理 POINTS</h3>
              </div>
            </div>

            <button
              onClick={() => {
                setNewPointVal('');
                // Set default unit to the first option if available
                const defaultUnit = UNIT_OPTIONS[activeType.type]?.[0] || '';
                setNewPointUnit(defaultUnit);
                setNewPointFreq('');
                setIsAddingPoint(true);
              }}
              className="w-full py-6 mb-8 border-2 border-dashed border-slate-900 rounded-[2.5rem] text-xs font-black text-slate-700 uppercase tracking-widest hover:border-emerald-500/50 hover:text-emerald-500 transition-all active:scale-95"
            >
              + 新增校正點位
            </button>

            {/* Add Point Modal */}
            {isAddingPoint && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] w-full max-w-sm shadow-2xl space-y-6">
                  <h3 className="text-xl font-black text-white italic uppercase tracking-tighter text-center">新增校正點位</h3>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">目標值 Target Value</label>
                      <input
                        type="text"
                        value={newPointVal}
                        onChange={(e) => setNewPointVal(e.target.value)}
                        placeholder="例如: 100"
                        className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-lg font-bold text-white focus:border-emerald-500 outline-none"
                        autoFocus
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">單位 Unit</label>
                      <div className="relative">
                        <select
                          value={newPointUnit}
                          onChange={(e) => setNewPointUnit(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-lg font-bold text-white focus:border-emerald-500 outline-none appearance-none"
                        >
                          {UNIT_OPTIONS[activeType.type] ? (
                            UNIT_OPTIONS[activeType.type].map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))
                          ) : (
                            <option value="">自訂 (未定義類別)</option>
                          )}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                      {/* Fallback input if no options defined */}
                      {!UNIT_OPTIONS[activeType.type] && (
                        <input
                          type="text"
                          value={newPointUnit}
                          onChange={(e) => setNewPointUnit(e.target.value)}
                          placeholder="輸入單位"
                          className="w-full mt-2 bg-slate-950 border border-slate-800 p-4 rounded-2xl text-lg font-bold text-white focus:border-emerald-500 outline-none"
                        />
                      )}
                    </div>
                  </div>

                  {['ac_voltage', 'ac_current', 'power'].includes(activeType.type) && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">頻率 Frequency</label>
                      <div className="relative">
                        <select
                          value={newPointFreq}
                          onChange={(e) => setNewPointFreq(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-lg font-bold text-white focus:border-emerald-500 outline-none appearance-none"
                        >
                          <option value="">無 None</option>
                          <option value="50Hz">50Hz</option>
                          <option value="60Hz">60Hz</option>
                          <option value="400Hz">400Hz</option>
                          <option value="1kHz">1kHz</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </div>
                  )}


                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setIsAddingPoint(false)}
                      className="py-4 bg-slate-800 text-slate-400 font-bold rounded-2xl hover:bg-slate-700 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => {
                        if (newPointVal && newPointUnit) {
                          addPointToType(newPointVal, newPointUnit, newPointFreq);
                          setIsAddingPoint(false);
                        } else {
                          alert("請輸入數值與選擇單位");
                        }
                      }}
                      className="py-4 bg-emerald-500 text-black font-black rounded-2xl shadow-lg hover:bg-emerald-400 transition-colors"
                    >
                      確認新增
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {activeType.points.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setActivePointId(p.id); setStep('READING_CAPTURE'); }}
                  className={`relative overflow-hidden group p-5 rounded-[2.5rem] border-2 transition-all active:scale-95 text-left flex flex-col justify-between h-48 ${p.readings.length >= activeType.maxReadings
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : p.readings.length > 0
                      ? 'bg-amber-500/5 border-amber-500/20'
                      : 'bg-slate-900 border-slate-800'
                    }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      {p.frequency || 'Standard Point'}
                    </div>
                    {p.readings.length >= activeType.maxReadings && (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-black">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-3xl font-black text-white italic tracking-tighter mb-1">
                      {p.targetValue}
                      <span className="text-[10px] text-slate-500 font-bold ml-1 not-italic">{p.unit}</span>
                    </div>
                    {p.readings.length > 0 ? (
                      <div className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                        已記錄 {p.readings[p.readings.length - 1].value}{p.unit}
                      </div>
                    ) : (
                      <div className="text-[10px] font-bold text-slate-600 uppercase">尚未校正</div>
                    )}
                  </div>

                  <div className="flex gap-1">
                    {Array.from({ length: activeType.maxReadings }).map((_, i) => (
                      <div key={i} className={`h-1.5 rounded-full flex-grow transition-all ${p.readings.length > i ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-800'}`}></div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
        }

        {
          step === 'READING_CAPTURE' && activeItem && activePoint && activeType && (
            <InstrumentCapture
              key={`${activePoint.id}-${activePoint.standard ? 'R' : 'S'}-${activePoint.readings.length}`}
              mode="reading"
              type={activeType.type}
              onReadingConfirm={handleReadingCapture}
              onBack={() => setStep('POINT_LIST')}
              currentIndex={activePoint.standard ? activePoint.readings.length + 1 : undefined}
              totalIndex={activeType.maxReadings}
              lockedStandard={!activePoint.standard ? session.standardCache[`${activeType.type}_${activePoint.targetValue}`] : undefined}
              onUnlock={() => unlockStandard(activePoint.targetValue)}
              // New prop to clarify mode
              isCapturingStandard={!activePoint.standard}
              // For standard capture of Temperature, do not enforce point unit (allow Ohm vs C mismatch) e.g. Standard might be Resistance
              expectedUnit={(!activePoint.standard && activeType.type === 'temperature') ? undefined : activePoint.unit}
              unitOptions={UNIT_OPTIONS[activeType.type]}
              availableStandards={session.standards}
              activeStandardInfo={activePoint.standard ? {
                maker: activePoint.standard.maker || '',
                model: activePoint.standard.model || '',
                serial: activePoint.standard.serial || ''
              } : undefined}
            />
          )
        }

        {
          step === 'EDIT_IDENTITY' && activeItem && (
            <div className="flex-grow p-8 bg-slate-950 overflow-y-auto">
              <button onClick={() => setStep('ITEM_DASHBOARD')} className="mb-10 p-3 bg-slate-900 rounded-2xl border border-slate-800 text-slate-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg></button>
              <h2 className="text-2xl font-black mb-10 italic uppercase tracking-tighter">編輯設備資訊</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">廠牌 Maker</label>
                  <input type="text" value={activeItem.identity.maker} onChange={e => {
                    setSession({ ...session, items: session.items.map(i => i.id === activeItemId ? { ...i, identity: { ...i.identity, maker: e.target.value } } : i) });
                  }} className="w-full bg-slate-900 border border-slate-800 p-5 rounded-[2rem] text-lg font-bold focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">型號 Model</label>
                  <input type="text" value={activeItem.identity.model} onChange={e => {
                    setSession({ ...session, items: session.items.map(i => i.id === activeItemId ? { ...i, identity: { ...i.identity, model: e.target.value } } : i) });
                  }} className="w-full bg-slate-900 border border-slate-800 p-5 rounded-[2rem] text-lg font-bold focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">序號 Serial No.</label>
                  <input type="text" value={activeItem.identity.serial_number} onChange={e => {
                    setSession({ ...session, items: session.items.map(i => i.id === activeItemId ? { ...i, identity: { ...i.identity, serial_number: e.target.value } } : i) });
                  }} className="w-full bg-slate-900 border border-slate-800 p-5 rounded-[2rem] text-lg font-bold focus:border-emerald-500 outline-none" />
                </div>
                <button onClick={() => setStep('ITEM_DASHBOARD')} className="w-full py-5 bg-emerald-500 text-black font-black rounded-[2rem] mt-10 shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs">儲存並返回</button>
              </div>
            </div>
          )
        }

        {
          step === 'SUCCESS' && (
            <div className="flex-grow flex flex-col items-center justify-center p-10 text-center animate-in zoom-in duration-500">
              <div className="w-32 h-32 bg-emerald-500/10 rounded-[3rem] flex items-center justify-center mb-10 border border-emerald-500/20 shadow-2xl shadow-emerald-500/20">
                <svg className="w-16 h-16 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase italic">Mission Complete</h2>
              <p className="text-slate-500 mb-12 text-[10px] font-bold uppercase tracking-widest max-w-[250px] leading-relaxed">所有設備之量測數據與原始照已同步至私有雲端伺服器。</p>
              <div className="flex flex-col w-full gap-4">
                <button onClick={clearSession} className="w-full py-6 bg-white text-black font-black rounded-[2.5rem] shadow-2xl active:scale-95 transition-all text-xs uppercase tracking-widest">開始新校正單 NEXT</button>
                <button
                  onClick={() => setStep('HISTORY_VIEW')}
                  className="w-full py-4 text-emerald-500 font-bold text-[10px] uppercase tracking-[0.2em] hover:text-white transition-colors"
                >
                  查看同步歷史記錄
                </button>
              </div>
            </div>
          )
        }

        {
          step === 'HISTORY_VIEW' && (
            <CalibrationHistory
              onBack={clearSession}
              initialQuotationNo={session.quotation_no}
            />
          )
        }
      </main >
    </div >
  );
};

export default App;
