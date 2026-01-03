
import React, { useState } from 'react';
import { getQuotationTemplate } from '../services/supabaseService';

interface Props {
  onSubmit: (data: { customer_name: string; quotation_no: string; temperature: string; humidity: string }) => void;
  onReset?: () => void;
  initialData: { customer_name: string; quotation_no: string; temperature?: string; humidity?: string };
}

const CalibrationForm: React.FC<Props> = ({ onSubmit, onReset, initialData }) => {
  const [data, setData] = useState({
    customer_name: initialData.customer_name,
    quotation_no: initialData.quotation_no,
    temperature: initialData.temperature || '',
    humidity: initialData.humidity || ''
  });

  const [isSyncing, setIsSyncing] = useState(false);

  React.useEffect(() => {
    setData({
      customer_name: initialData.customer_name,
      quotation_no: initialData.quotation_no,
      temperature: initialData.temperature || '',
      humidity: initialData.humidity || ''
    });
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (data.customer_name && data.quotation_no) {
      onSubmit(data);
    } else {
      alert("請填寫必要欄位");
    }
  };

  return (
    <div className="flex-grow p-6 overflow-y-auto flex flex-col justify-center">
      <div className="max-w-md mx-auto w-full relative">
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="absolute -top-10 right-0 text-slate-500 text-[10px] font-bold uppercase tracking-widest border border-slate-700 px-3 py-1 rounded-full hover:bg-slate-800 transition-all"
          >
            重置/清除 Reset
          </button>
        )}
        <h2 className="text-3xl font-black mb-2 text-center italic uppercase tracking-tighter">建立校正任務</h2>
        <p className="text-slate-500 text-[10px] font-bold text-center uppercase tracking-[0.2em] mb-12">Session Initialization</p>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">報價單編號 Quotation No.</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={data.quotation_no}
                onChange={e => setData({ ...data, quotation_no: e.target.value })}
                placeholder="QT-XXXXXX"
                className="flex-grow bg-slate-900 border border-slate-800 focus:border-emerald-500 p-5 rounded-[2rem] outline-none transition-all font-black text-xl tracking-wider uppercase"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!data.quotation_no) return alert("請先輸入編號");
                  setIsSyncing(true);
                  try {
                    const template = await getQuotationTemplate(data.quotation_no);
                    if (template) {
                      setData({ ...data, customer_name: template.customer_name });
                      alert(`已同步：找到屬於 ${template.customer_name} 的報價單，包含 ${template.items?.length || 0} 件設備。`);
                    } else {
                      alert("找不到該單號的預設模板，請手動輸入資訊。");
                    }
                  } catch (err) {
                    console.error(err);
                    alert("同步搜尋發生錯誤");
                  } finally {
                    setIsSyncing(false);
                  }
                }}
                disabled={isSyncing}
                className="flex-none bg-slate-800 hover:bg-slate-700 text-emerald-500 text-[10px] font-black px-6 rounded-[2rem] border border-emerald-500/20 shadow-lg disabled:opacity-50 transition-all"
              >
                {isSyncing ? '...' : 'SYNC'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">客戶名稱 Customer *</label>
            <input
              type="text"
              required
              value={data.customer_name}
              onChange={e => setData({ ...data, customer_name: e.target.value })}
              placeholder="請輸入客戶名稱"
              className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 p-5 rounded-[2rem] outline-none transition-all font-bold text-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">溫度 Temp (℃)</label>
              <input
                type="text"
                value={data.temperature}
                onChange={e => setData({ ...data, temperature: e.target.value })}
                placeholder="23.0"
                className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 p-5 rounded-[2rem] outline-none transition-all font-bold text-lg"
              />
            </div>
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">濕度 Humidity (%)</label>
              <input
                type="text"
                value={data.humidity}
                onChange={e => setData({ ...data, humidity: e.target.value })}
                placeholder="50"
                className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 p-5 rounded-[2rem] outline-none transition-all font-bold text-lg"
              />
            </div>
          </div>

          <div className="pt-8">
            <button
              type="submit"
              className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-black font-black rounded-[2.5rem] shadow-2xl shadow-emerald-500/20 transition-all active:scale-95 text-xs uppercase tracking-widest"
            >
              進入設備清單 Next
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CalibrationForm;
