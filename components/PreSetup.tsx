
import React, { useState, useEffect } from 'react';
import {
    getStandardInstruments,
    saveQuotationTemplate,
    getQuotationTemplate,
    StandardInstrument,
    QuotationTemplate
} from '../services/supabaseService';
import { CATEGORY_LABELS, UNIT_OPTIONS } from '../App';

interface Props {
    onBack: () => void;
    onStartCalibration: (quotationNo: string) => void;
}

const PreSetup: React.FC<Props> = ({ onBack, onStartCalibration }) => {
    const [quotationNo, setQuotationNo] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [standards, setStandards] = useState<StandardInstrument[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadStandards();
    }, []);

    const loadStandards = async () => {
        const data = await getStandardInstruments();
        setStandards(data);
    };

    const addItem = () => {
        setItems([...items, {
            id: crypto.randomUUID(),
            equipment_id: `EQ-${Date.now()}`,
            maker: '',
            model: '',
            serial_number: '',
            measurementTypes: []
        }]);
    };

    const addTypeToItem = (itemId: string, type: string) => {
        setItems(items.map(item => {
            if (item.id !== itemId) return item;
            return {
                ...item,
                measurementTypes: [...item.measurementTypes, {
                    id: crypto.randomUUID(),
                    type,
                    maxReadings: 3,
                    points: []
                }]
            };
        }));
    };

    const addPointToType = (itemId: string, typeId: string) => {
        setItems(items.map(item => {
            if (item.id !== itemId) return item;
            return {
                ...item,
                measurementTypes: item.measurementTypes.map((t: any) => {
                    if (t.id !== typeId) return t;
                    return {
                        ...t,
                        points: [...t.points, {
                            id: crypto.randomUUID(),
                            targetValue: '',
                            unit: UNIT_OPTIONS[t.type]?.[0] || '',
                            frequency: ''
                        }]
                    };
                })
            };
        }));
    };

    const handleSave = async () => {
        if (!quotationNo || !customerName) {
            alert("請填寫單號與客戶名稱");
            return;
        }
        setIsLoading(true);
        try {
            await saveQuotationTemplate({
                quotation_no: quotationNo,
                customer_name: customerName,
                items
            });
            alert("儲存成功！");
        } catch (err) {
            console.error(err);
            alert("儲存失敗");
        } finally {
            setIsLoading(false);
        }
    };

    const loadTemplate = async () => {
        if (!quotationNo) return;
        setIsLoading(true);
        const template = await getQuotationTemplate(quotationNo);
        if (template) {
            setCustomerName(template.customer_name);
            setItems(template.items || []);
        } else {
            alert("找不到該單號的模板");
        }
        setIsLoading(false);
    };

    return (
        <div className="flex-grow p-8 bg-slate-950 overflow-y-auto text-slate-100 pb-20">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-10">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-3 bg-slate-900 rounded-2xl border border-slate-800 text-slate-500 hover:text-white transition-all">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <h1 className="text-3xl font-black italic uppercase tracking-tighter">事前作業 Pre-Setup (Desktop)</h1>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-black font-black rounded-xl shadow-lg transition-all disabled:opacity-50"
                        >
                            儲存模板 SAVE
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 space-y-6">
                        <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest">基本資訊 Basic Info</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 block mb-2">報價單條碼/編號 Quotation No.</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={quotationNo}
                                        onChange={e => setQuotationNo(e.target.value.toUpperCase())}
                                        className="flex-grow bg-slate-950 border border-slate-800 p-4 rounded-xl outline-none focus:border-emerald-500 transition-all font-mono text-lg"
                                        placeholder="例如: QT2024001"
                                    />
                                    <button onClick={loadTemplate} className="px-4 bg-slate-800 rounded-xl text-xs font-black hover:bg-slate-700">讀取</button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 block mb-2">客戶名稱 Customer Name</label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl outline-none focus:border-emerald-500 transition-all"
                                    placeholder="輸入完整客戶名稱"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800">
                        <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6">標準件清單 Standards</h2>
                        <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {standards.map(std => (
                                <div key={std.id} className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800">
                                    <div>
                                        <div className="text-sm font-bold">{std.maker} {std.model}</div>
                                        <div className="text-[10px] text-slate-500 font-mono">{std.serial_number}</div>
                                    </div>
                                    <div className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded">可選用</div>
                                </div>
                            ))}
                            {standards.length === 0 && <div className="text-slate-600 text-xs italic">尚無標準件資料</div>}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-black italic uppercase">待校設備清單 Equipment List ({items.length})</h2>
                        <button onClick={addItem} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-emerald-500 font-black rounded-xl border border-emerald-500/20 text-xs uppercase tracking-widest">+ 新增設備</button>
                    </div>

                    <div className="space-y-6">
                        {items.map((item, idx) => (
                            <div key={item.id} className="bg-slate-900 rounded-[2rem] border border-slate-800 p-8">
                                <div className="flex justify-between items-start mb-8">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-grow">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">設備編號 ID</label>
                                            <input
                                                value={item.equipment_id}
                                                onChange={e => {
                                                    const newItems = [...items];
                                                    newItems[idx].equipment_id = e.target.value;
                                                    setItems(newItems);
                                                }}
                                                className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg text-sm font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">廠牌 Maker</label>
                                            <input
                                                value={item.maker}
                                                onChange={e => {
                                                    const newItems = [...items];
                                                    newItems[idx].maker = e.target.value;
                                                    setItems(newItems);
                                                }}
                                                className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg text-sm font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">型號 Model</label>
                                            <input
                                                value={item.model}
                                                onChange={e => {
                                                    const newItems = [...items];
                                                    newItems[idx].model = e.target.value;
                                                    setItems(newItems);
                                                }}
                                                className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg text-sm font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">序號 S/N</label>
                                            <input
                                                value={item.serial_number}
                                                onChange={e => {
                                                    const newItems = [...items];
                                                    newItems[idx].serial_number = e.target.value;
                                                    setItems(newItems);
                                                }}
                                                className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg text-sm font-bold"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setItems(items.filter(i => i.id !== item.id))}
                                        className="ml-4 p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">校正量別與點位</h4>
                                        <div className="flex gap-2">
                                            <select
                                                className="bg-slate-950 border border-slate-800 text-xs p-2 rounded-lg"
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        addTypeToItem(item.id, e.target.value);
                                                        e.target.value = '';
                                                    }
                                                }}
                                            >
                                                <option value="">+ 新增量別</option>
                                                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                                    <option key={k} value={k}>{v}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {item.measurementTypes.map((t: any, tIdx: number) => (
                                            <div key={t.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="text-xs font-black text-white italic">{CATEGORY_LABELS[t.type]}</span>
                                                    <button
                                                        onClick={() => {
                                                            const newItems = [...items];
                                                            newItems[idx].measurementTypes = newItems[idx].measurementTypes.filter((mt: any) => mt.id !== t.id);
                                                            setItems(newItems);
                                                        }}
                                                        className="text-rose-500 text-[10px] font-bold"
                                                    >移除</button>
                                                </div>

                                                <div className="space-y-3">
                                                    {t.points.map((p: any, pIdx: number) => (
                                                        <div key={p.id} className="grid grid-cols-3 gap-2">
                                                            <input
                                                                value={p.targetValue}
                                                                placeholder="數值"
                                                                onChange={e => {
                                                                    const newItems = [...items];
                                                                    newItems[idx].measurementTypes[tIdx].points[pIdx].targetValue = e.target.value;
                                                                    setItems(newItems);
                                                                }}
                                                                className="bg-slate-900 border border-slate-800 p-2 rounded text-xs font-bold"
                                                            />
                                                            <select
                                                                value={p.unit}
                                                                onChange={e => {
                                                                    const newItems = [...items];
                                                                    newItems[idx].measurementTypes[tIdx].points[pIdx].unit = e.target.value;
                                                                    setItems(newItems);
                                                                }}
                                                                className="bg-slate-900 border border-slate-800 p-2 rounded text-xs"
                                                            >
                                                                {UNIT_OPTIONS[t.type]?.map(u => <option key={u} value={u}>{u}</option>)}
                                                            </select>
                                                            <button
                                                                onClick={() => {
                                                                    const newItems = [...items];
                                                                    newItems[idx].measurementTypes[tIdx].points = newItems[idx].measurementTypes[tIdx].points.filter((pt: any) => pt.id !== p.id);
                                                                    setItems(newItems);
                                                                }}
                                                                className="text-slate-600 hover:text-rose-500"
                                                            >×</button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => addPointToType(item.id, t.id)}
                                                        className="w-full py-2 border border-dashed border-slate-800 rounded-lg text-[10px] font-bold text-slate-500 hover:border-emerald-500/30 hover:text-emerald-500 transition-all"
                                                    >+ 新增校正點</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreSetup;
