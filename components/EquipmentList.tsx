
import React from 'react';

interface EquipmentItem {
    id: string;
    equipment_id: string;
    identity: { maker: string; model: string; serial_number: string };
    measurementTypes: { id: string; type: string; points: any[] }[];
}

interface Props {
    items: EquipmentItem[];
    quotationNo: string;
    onAddItem: () => void;
    onSelectItem: (id: string) => void;
    onSubmitAll: () => void;
    isSyncing: boolean;
    categoryLabels: Record<string, string>;
}

const EquipmentList: React.FC<Props> = ({
    items,
    quotationNo,
    onAddItem,
    onSelectItem,
    onSubmitAll,
    isSyncing,
    categoryLabels
}) => {
    return (
        <div className="flex-grow flex flex-col p-6 overflow-y-auto pb-32">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-emerald-500">待校設備清單</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Quotation: {quotationNo}</p>
                </div>
                <button
                    onClick={onAddItem}
                    className="px-5 py-3 bg-emerald-500 text-black text-xs font-black rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                    + 新增設備
                </button>
            </div>

            <div className="space-y-4">
                {items.length === 0 ? (
                    <div className="h-64 border-2 border-dashed border-slate-900 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-700 p-10 text-center">
                        <div className="text-4xl mb-4">📦</div>
                        <div className="text-sm font-bold mb-1">尚未建立任何設備</div>
                        <div className="text-[10px] uppercase tracking-widest">請點擊右上方按鈕開始</div>
                    </div>
                ) : (
                    items.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onSelectItem(item.id)}
                            className="w-full bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] flex flex-col text-left hover:border-emerald-500/50 transition-all active:scale-[0.98]"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">{item.equipment_id}</div>
                                    <div className="text-lg font-black text-white">{item.identity.model || '未命名設備'}</div>
                                </div>
                                <div className="bg-slate-800 px-3 py-1 rounded-full text-[9px] font-bold text-slate-400 border border-slate-700 uppercase">
                                    {item.measurementTypes.length} Categories
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {item.measurementTypes.length > 0 ? (
                                    item.measurementTypes.map(t => (
                                        <span key={t.id} className="text-[9px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md border border-emerald-500/20 font-bold uppercase">
                                            {categoryLabels[t.type] || t.type}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-[9px] text-slate-600 italic">尚未新增量別</span>
                                )}
                            </div>
                        </button>
                    ))
                )}
            </div>

            {items.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent pb-[calc(1.5rem+safe-area-inset-bottom)]">
                    <button
                        onClick={onSubmitAll}
                        disabled={isSyncing}
                        className="w-full py-5 bg-white text-black font-black rounded-[2rem] shadow-2xl disabled:opacity-20 active:scale-95 transition-all text-xs uppercase tracking-widest"
                    >
                        {isSyncing ? '數據同步中...' : `提交全部 ${items.length} 件紀錄`}
                    </button>
                </div>
            )}
        </div>
    );
};

export default EquipmentList;
