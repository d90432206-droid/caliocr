
import React, { useState } from 'react';

interface Props {
  onSubmit: (data: { customer_name: string; quotation_no: string }) => void;
  initialData: { customer_name: string; quotation_no: string };
}

const CalibrationForm: React.FC<Props> = ({ onSubmit, initialData }) => {
  const [data, setData] = useState(initialData);

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
      <div className="max-w-md mx-auto w-full">
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
                onClick={() => {
                  if (!data.quotation_no) return alert("請先輸入編號");
                  alert(`已連線系統...\n找到報價單 ${data.quotation_no}\n客戶：儀器實驗室\n包含 6 件待校儀器`);
                  setData({ ...data, customer_name: '儀器實驗室 (模擬數據)' });
                }}
                className="flex-none bg-slate-800 hover:bg-slate-700 text-emerald-500 text-[10px] font-black px-6 rounded-[2rem] border border-emerald-500/20 shadow-lg"
              >
                SYNC
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
