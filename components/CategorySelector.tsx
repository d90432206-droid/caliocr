
import React, { useState } from 'react';

export type CategoryId =
  | 'dc_voltage' | 'dc_current'
  | 'ac_voltage' | 'ac_current'
  | 'resistance' | 'power'
  | 'temperature' | 'pressure'
  | 'diff_pressure' | 'digital_pressure';

interface Props {
  onSelect: (type: CategoryId, count: number) => void;
  onBack: () => void;
}

const DEFAULT_COUNTS: Record<string, number> = {
  dc_voltage: 1,
  dc_current: 1,
  ac_voltage: 1,
  ac_current: 1,
  resistance: 1,
  power: 1,
  temperature: 3,      // 溫度預設拍3次
  pressure: 3,         // 壓力預設拍3次
  diff_pressure: 3,    // 差壓預設拍3次
  digital_pressure: 3  // 數字計預設拍3次
};

const CategorySelector: React.FC<Props> = ({ onSelect, onBack }) => {
  const [selectedId, setSelectedId] = useState<CategoryId | null>(null);
  const [count, setCount] = useState(3);

  const categories = [
    { id: 'dc_voltage', label: '直流電壓 DCV', icon: '🔋', color: 'bg-amber-500' },
    { id: 'dc_current', label: '直流電流 DCA', icon: '⚡', color: 'bg-orange-500' },
    { id: 'ac_voltage', label: '交流電壓 ACV', icon: '〰️', color: 'bg-yellow-500' },
    { id: 'ac_current', label: '交流電流 ACA', icon: '🔌', color: 'bg-yellow-600' },
    { id: 'resistance', label: '電阻 Resistance', icon: 'Ω', color: 'bg-amber-600' },
    { id: 'power', label: '電功率 Power', icon: '📊', color: 'bg-orange-600' },
    { id: 'temperature', label: '溫度記錄 Temp', icon: '🌡️', color: 'bg-rose-500' },
    { id: 'pressure', label: '壓力數值 Press', icon: '⏲️', color: 'bg-blue-500' },
    { id: 'diff_pressure', label: '差壓 Diff Press', icon: '🌪️', color: 'bg-cyan-500' },
    { id: 'digital_pressure', label: '數字壓力計 Digital', icon: '🔢', color: 'bg-indigo-500' }
  ] as const;

  const handleCategoryClick = (id: CategoryId) => {
    setSelectedId(id);
    setCount(DEFAULT_COUNTS[id] || 3);
  };

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId, count);
    }
  };

  return (
    <div className="flex-grow p-6 flex flex-col items-center overflow-y-auto">
      <div className="max-w-md w-full pb-20">
        {!selectedId ? (
          <>
            <h2 className="text-3xl font-black mb-2 text-center italic uppercase tracking-tighter">請選擇校正量別</h2>
            <p className="text-slate-500 text-[10px] font-bold text-center uppercase tracking-[0.2em] mb-10">Select Measurement Category</p>

            <div className="grid grid-cols-1 gap-3">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id as CategoryId)}
                  className="group flex items-center p-4 bg-slate-900/50 border border-slate-800/80 rounded-[2rem] hover:border-emerald-500/50 hover:bg-slate-900 transition-all active:scale-[0.97] text-left"
                >
                  <div className={`w-12 h-12 ${cat.color} rounded-2xl flex items-center justify-center text-xl shadow-lg mr-5 group-hover:scale-110 transition-transform`}>
                    {cat.icon}
                  </div>
                  <div className="flex-grow">
                    <div className="text-base font-black text-white">{cat.label}</div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Default: {DEFAULT_COUNTS[cat.id] || 3} readings</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="animate-in slide-in-from-right duration-300">
            <button
              onClick={() => setSelectedId(null)}
              className="mb-8 flex items-center gap-2 text-slate-500 font-bold text-xs uppercase"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
              重新選擇類型
            </button>

            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl text-center">
              <div className="w-20 h-20 mx-auto bg-emerald-500/10 rounded-3xl flex items-center justify-center text-4xl mb-6 border border-emerald-500/20">
                {categories.find(c => c.id === selectedId)?.icon}
              </div>
              <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">
                {categories.find(c => c.id === selectedId)?.label}
              </h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-10">設定拍照讀取次數</p>

              <div className="flex items-center justify-center gap-8 mb-10">
                <button
                  onClick={() => setCount(Math.max(1, count - 1))}
                  className="w-12 h-12 rounded-full border border-slate-700 bg-slate-800 text-white font-black text-xl active:scale-90"
                >-</button>
                <div className="text-5xl font-black text-emerald-500 font-mono">{count}</div>
                <button
                  onClick={() => setCount(Math.min(10, count + 1))}
                  className="w-12 h-12 rounded-full border border-slate-700 bg-slate-800 text-white font-black text-xl active:scale-90"
                >+</button>
              </div>

              <button
                onClick={handleConfirm}
                className="w-full py-5 bg-emerald-500 text-black font-black rounded-3xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all text-sm uppercase tracking-widest"
              >
                確認並開始校正
              </button>
            </div>
          </div>
        )}

        <button
          onClick={onBack}
          className="mt-12 w-full py-4 border border-slate-800 rounded-2xl text-[10px] text-slate-500 font-black uppercase tracking-widest hover:text-white hover:border-slate-700 transition-all"
        >
          返回
        </button>
      </div>
    </div>
  );
};

export default CategorySelector;
