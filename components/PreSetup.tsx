
import React, { useState, useEffect } from 'react';
import {
    getStandardInstruments,
    saveQuotationTemplate,
    getQuotationTemplate,
    listQuotationTemplates,
    saveStandardInstrument,
    deleteStandardInstrument,
    deleteQuotationTemplate,
    StandardInstrument,
    QuotationTemplate
} from '../services/supabaseService';
import { CATEGORY_LABELS, UNIT_OPTIONS } from '../App';

interface Props {
    onBack: () => void;
    onStartCalibration: (quotationNo: string) => void;
}

type ViewMode = 'QUOTATION' | 'STANDARD' | 'OVERVIEW';

const PreSetup: React.FC<Props> = ({ onBack, onStartCalibration }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('OVERVIEW');
    const [quotationNo, setQuotationNo] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [standards, setStandards] = useState<StandardInstrument[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [templates, setTemplates] = useState<QuotationTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // New Standard State
    const [newStd, setNewStd] = useState<Omit<StandardInstrument, 'id'>>({
        maker: '',
        model: '',
        serial_number: '',
        categories: [],
        reports: [{ report_no: '', expiry_date: '' }]
    });

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setIsLoading(true);
        await Promise.all([loadStandards(), loadTemplates()]);
        setIsLoading(false);
    };

    const loadStandards = async () => {
        const data = await getStandardInstruments();
        setStandards(data);
    };

    const loadTemplates = async () => {
        const data = await listQuotationTemplates();
        setTemplates(data || []);
    };

    const handleSaveStandard = async (e: React.FormEvent) => {
        e.preventDefault();
        const validReports = newStd.reports.filter(r => r.report_no || r.expiry_date);
        if (!newStd.maker || !newStd.model || !newStd.serial_number || validReports.length === 0) {
            alert("請填寫基本資訊與至少一個校正報告");
            return;
        }
        setIsLoading(true);
        try {
            await saveStandardInstrument({
                ...newStd,
                reports: validReports
            });
            setNewStd({
                maker: '',
                model: '',
                serial_number: '',
                categories: [],
                reports: [{ report_no: '', expiry_date: '' }]
            });
            await loadStandards();
            alert("標準件儲存成功");
        } catch (err) {
            console.error(err);
            alert("儲存失敗");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteStandard = async (id: string) => {
        if (!window.confirm("確定要刪除此標準件嗎？")) return;
        setIsLoading(true);
        try {
            await deleteStandardInstrument(id);
            await loadStandards();
        } catch (err) {
            console.error(err);
            alert("刪除失敗");
        } finally {
            setIsLoading(false);
        }
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

    const handleSaveQuotation = async () => {
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
            await loadTemplates();
            alert("報價單模板儲存成功！");
            setViewMode('OVERVIEW');
        } catch (err) {
            console.error(err);
            alert("儲存失敗");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteTemplate = async (qNo: string) => {
        if (!window.confirm(`確定要刪除報價單模板 ${qNo} 嗎？`)) return;
        setIsLoading(true);
        try {
            await deleteQuotationTemplate(qNo);
            await loadTemplates();
        } catch (err) {
            console.error(err);
            alert("刪除失敗");
        } finally {
            setIsLoading(false);
        }
    };

    const selectTemplate = (tpl: QuotationTemplate) => {
        setQuotationNo(tpl.quotation_no);
        setCustomerName(tpl.customer_name);
        setItems(tpl.items || []);
        setViewMode('QUOTATION');
    };

    const createNewQuotation = () => {
        setQuotationNo('');
        setCustomerName('');
        setItems([]);
        setViewMode('QUOTATION');
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
            {/* Sidebar/Tab Navigation */}
            <div className="flex-none border-b border-slate-800 bg-slate-900/50 p-2 flex gap-2">
                <button
                    onClick={onBack}
                    className="p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all mr-4"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button
                    onClick={() => setViewMode('OVERVIEW')}
                    className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'OVERVIEW' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-400'}`}
                >
                    報價單一覽 OVERVIEW
                </button>
                <button
                    onClick={() => setViewMode('QUOTATION')}
                    className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'QUOTATION' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-400'}`}
                >
                    {quotationNo ? `編輯 ${quotationNo}` : '+ 新增報價單'}
                </button>
                <button
                    onClick={() => setViewMode('STANDARD')}
                    className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'STANDARD' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-400'}`}
                >
                    標準件管理 STANDARDS
                </button>
            </div>

            <div className="flex-grow overflow-y-auto p-8 custom-scrollbar pb-20">
                <div className="max-w-6xl mx-auto">

                    {viewMode === 'OVERVIEW' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div className="flex justify-between items-center">
                                <h2 className="text-3xl font-black italic uppercase tracking-tighter">報價單模板列表</h2>
                                <button onClick={createNewQuotation} className="px-6 py-3 bg-emerald-600 text-black font-black rounded-xl text-xs uppercase">+ 建立新報價單</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {templates.map(tpl => (
                                    <div key={tpl.quotation_no} className="relative group">
                                        <button
                                            onClick={() => selectTemplate(tpl)}
                                            className="w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl text-left hover:border-emerald-500/50 transition-all"
                                        >
                                            <div className="text-[10px] font-black text-emerald-500 uppercase mb-1">{tpl.quotation_no}</div>
                                            <div className="text-xl font-black mb-4 group-hover:text-emerald-400 transition-colors">{tpl.customer_name}</div>
                                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                                <span>包含 {tpl.items?.length || 0} 件設備</span>
                                                <span className="text-emerald-500 group-hover:translate-x-1 transition-transform">EDIT →</span>
                                            </div>
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.quotation_no); }}
                                            className="absolute top-4 right-4 p-2 text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                            title="Delete Template"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                ))}
                                {templates.length === 0 && (
                                    <div className="col-span-full py-20 text-center bg-slate-900/30 rounded-[3rem] border border-dashed border-slate-800">
                                        <p className="text-slate-500 font-bold uppercase tracking-widest">目前沒有預設的報價單模板</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {viewMode === 'STANDARD' && (
                        <div className="space-y-12 animate-in slide-in-from-right-10 duration-500">
                            <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-10">
                                <h3 className="text-2xl font-black italic uppercase mb-8 tracking-tighter">新增標準件 MASTER INSTRUMENT</h3>
                                <form onSubmit={handleSaveStandard} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">廠牌 Maker</label>
                                        <input value={newStd.maker} onChange={e => setNewStd({ ...newStd, maker: e.target.value })} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl outline-none focus:border-emerald-500 transition-all" placeholder="e.g. Fluke" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">型號 Model</label>
                                        <input value={newStd.model} onChange={e => setNewStd({ ...newStd, model: e.target.value })} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl outline-none focus:border-emerald-500 transition-all" placeholder="e.g. 8508A" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">序號 S/N</label>
                                        <input value={newStd.serial_number} onChange={e => setNewStd({ ...newStd, serial_number: e.target.value })} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl outline-none focus:border-emerald-500 transition-all font-mono" placeholder="S/N 12345" />
                                    </div>
                                    <div className="space-y-4 md:col-span-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">校正量別 Categories</label>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => {
                                                        const cats = newStd.categories.includes(key)
                                                            ? newStd.categories.filter(c => c !== key)
                                                            : [...newStd.categories, key];
                                                        setNewStd({ ...newStd, categories: cats });
                                                    }}
                                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${newStd.categories.includes(key) ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-slate-950 text-slate-500 border-slate-800'}`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="md:col-span-3 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">校正報告及其有效期 Calibration Reports</label>
                                            <button
                                                type="button"
                                                onClick={() => setNewStd({ ...newStd, reports: [...newStd.reports, { report_no: '', expiry_date: '' }] })}
                                                className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20"
                                            >
                                                + 新增報告
                                            </button>
                                        </div>
                                        {newStd.reports.map((report, rIdx) => (
                                            <div key={rIdx} className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 animate-in slide-in-from-top-2">
                                                <div className="md:col-span-3 space-y-2">
                                                    <label className="text-[9px] font-bold text-slate-600 uppercase">報告編號 Report No.</label>
                                                    <input
                                                        value={report.report_no}
                                                        onChange={e => {
                                                            const rs = [...newStd.reports];
                                                            rs[rIdx].report_no = e.target.value;
                                                            setNewStd({ ...newStd, reports: rs });
                                                        }}
                                                        className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl outline-none focus:border-emerald-500 text-xs font-black"
                                                        placeholder="e.g. R2024-001"
                                                    />
                                                </div>
                                                <div className="md:col-span-3 space-y-2">
                                                    <label className="text-[9px] font-bold text-slate-600 uppercase">有效日期 Expiry Date</label>
                                                    <input
                                                        type="date"
                                                        value={report.expiry_date}
                                                        onChange={e => {
                                                            const rs = [...newStd.reports];
                                                            rs[rIdx].expiry_date = e.target.value;
                                                            setNewStd({ ...newStd, reports: rs });
                                                        }}
                                                        className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl outline-none focus:border-emerald-500 text-xs font-black"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={newStd.reports.length === 1}
                                                    onClick={() => setNewStd({ ...newStd, reports: newStd.reports.filter((_, i) => i !== rIdx) })}
                                                    className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-xl disabled:opacity-30 transition-all flex justify-center"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="md:col-span-3 pt-4">
                                        <button type="submit" disabled={isLoading} className="w-full py-4 bg-emerald-600 text-black font-black rounded-2xl hover:bg-emerald-500 shadow-lg disabled:opacity-50 transition-all uppercase tracking-widest text-sm">儲存標準器與校正紀錄</button>
                                    </div>
                                </form>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-xl font-black italic uppercase">現有標準件庫 ({standards.length})</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {standards.map(std => (
                                        <div key={std.id} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col justify-between">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <div className="text-lg font-black text-white italic">{std.maker} {std.model}</div>
                                                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{std.serial_number}</div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <div className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[9px] font-black border border-emerald-500/20 uppercase tracking-widest">ACTIVE</div>
                                                    <button onClick={() => handleDeleteStandard(std.id)} className="p-1 text-slate-600 hover:text-rose-500 transition-all">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 border-t border-slate-800/50 pt-4">
                                                <div className="col-span-2">
                                                    <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">對應量別 Categories</div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {std.categories?.map(cat => (
                                                            <span key={cat} className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 font-black uppercase">{CATEGORY_LABELS[cat] || cat}</span>
                                                        ))}
                                                        {(!std.categories || std.categories.length === 0) && <span className="text-[8px] text-slate-600">未定義</span>}
                                                    </div>
                                                </div>
                                                <div className="col-span-2 mt-2">
                                                    <div className="text-[9px] font-bold text-slate-500 uppercase mb-2">校正報告 Reports ({std.reports?.length || 0})</div>
                                                    <div className="space-y-1.5">
                                                        {std.reports?.map((r, i) => (
                                                            <div key={i} className="flex justify-between items-center bg-slate-950/40 p-2 rounded-lg border border-slate-800/50">
                                                                <span className="text-[9px] font-black text-emerald-400">{r.report_no}</span>
                                                                <span className="text-[9px] font-bold text-slate-500">EXP: {r.expiry_date}</span>
                                                            </div>
                                                        ))}
                                                        {(!std.reports || std.reports.length === 0) && <div className="text-[9px] text-slate-600">無紀錄</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {viewMode === 'QUOTATION' && (
                        <div className="space-y-10 animate-in slide-in-from-left-10 duration-500">
                            <div className="bg-slate-900 p-10 rounded-[2.5rem] border border-slate-800">
                                <div className="flex justify-between items-center mb-10">
                                    <h2 className="text-2xl font-black italic uppercase tracking-tighter">報價單條目編輯</h2>
                                    <button onClick={handleSaveQuotation} className="px-10 py-3 bg-emerald-600 text-black font-black rounded-xl text-xs uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">儲存變更 SAVE</button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">報價單條碼/編號 Quotation No.</label>
                                        <input value={quotationNo} onChange={e => setQuotationNo(e.target.value.toUpperCase())} className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl outline-none focus:border-emerald-500 transition-all font-mono text-xl text-emerald-400" placeholder="e.g. QT2024001" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">客戶名稱 Customer Name</label>
                                        <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl outline-none focus:border-emerald-500 transition-all font-bold text-xl" placeholder="輸入完整客戶名稱" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className="flex justify-between items-center px-4">
                                    <h3 className="text-xl font-black italic uppercase">待校設備清單 ({items.length})</h3>
                                    <button onClick={addItem} className="px-6 py-3 bg-slate-800 text-emerald-400 font-black rounded-xl text-[10px] uppercase border border-emerald-500/20">+ 新增設備</button>
                                </div>

                                <div className="space-y-6">
                                    {items.map((item, idx) => (
                                        <div key={item.id} className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-10">
                                            <div className="flex justify-between items-start mb-8 gap-4">
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-grow">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">設備 ID</label>
                                                        <input value={item.equipment_id} onChange={e => {
                                                            const newItems = [...items]; newItems[idx].equipment_id = e.target.value; setItems(newItems);
                                                        }} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-black" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">廠牌 Maker</label>
                                                        <input value={item.maker} onChange={e => {
                                                            const newItems = [...items]; newItems[idx].maker = e.target.value; setItems(newItems);
                                                        }} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-black" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">型號 Model</label>
                                                        <input value={item.model} onChange={e => {
                                                            const newItems = [...items]; newItems[idx].model = e.target.value; setItems(newItems);
                                                        }} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-black" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">序號 S/N</label>
                                                        <input value={item.serial_number} onChange={e => {
                                                            const newItems = [...items]; newItems[idx].serial_number = e.target.value; setItems(newItems);
                                                        }} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-black font-mono" />
                                                    </div>
                                                </div>
                                                <button onClick={() => setItems(items.filter(i => i.id !== item.id))} className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all">
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>

                                            <div className="pt-6 border-t border-slate-800/50">
                                                <div className="flex justify-between items-center mb-6">
                                                    <h4 className="text-[10px] font-black text-emerald-500 tracking-widest uppercase italic">校正量別與點位 Setup</h4>
                                                    <select
                                                        className="bg-slate-950 border border-slate-800 text-[10px] font-bold p-2 px-4 rounded-xl text-emerald-400"
                                                        onChange={(e) => { if (e.target.value) { addTypeToItem(item.id, e.target.value); e.target.value = ''; } }}
                                                    >
                                                        <option value="">+ 新增量別 Categories</option>
                                                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                                                    </select>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {item.measurementTypes.map((t: any, tIdx: number) => (
                                                        <div key={t.id} className="bg-slate-950 border border-slate-800 rounded-[2rem] p-8">
                                                            <div className="flex justify-between items-center mb-6">
                                                                <span className="text-xs font-black text-white italic tracking-tighter">{CATEGORY_LABELS[t.type]}</span>
                                                                <button onClick={() => {
                                                                    const newItems = [...items]; newItems[idx].measurementTypes = newItems[idx].measurementTypes.filter((mt: any) => mt.id !== t.id); setItems(newItems);
                                                                }} className="text-rose-500 text-[9px] font-black uppercase tracking-widest bg-rose-500/10 px-3 py-1 rounded-full">REMOVE</button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {t.points.map((p: any, pIdx: number) => (
                                                                    <div key={p.id} className="grid grid-cols-3 gap-2 items-center">
                                                                        <input value={p.targetValue} onChange={e => {
                                                                            const newItems = [...items]; newItems[idx].measurementTypes[tIdx].points[pIdx].targetValue = e.target.value; setItems(newItems);
                                                                        }} className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-xs font-black text-emerald-400" placeholder="VALUE" />
                                                                        <select value={p.unit} onChange={e => {
                                                                            const newItems = [...items]; newItems[idx].measurementTypes[tIdx].points[pIdx].unit = e.target.value; setItems(newItems);
                                                                        }} className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-[10px] font-bold appearance-none text-center">
                                                                            {UNIT_OPTIONS[t.type]?.map(u => <option key={u} value={u}>{u}</option>)}
                                                                        </select>
                                                                        <button onClick={() => {
                                                                            const newItems = [...items]; newItems[idx].measurementTypes[tIdx].points = newItems[idx].measurementTypes[tIdx].points.filter((pt: any) => pt.id !== p.id); setItems(newItems);
                                                                        }} className="text-slate-600 hover:text-rose-500 text-lg font-black">→</button>
                                                                    </div>
                                                                ))}
                                                                <button onClick={() => addPointToType(item.id, t.id)} className="w-full py-2.5 mt-2 border border-dashed border-slate-800 rounded-xl text-[9px] font-black text-slate-500 hover:border-emerald-500/50 hover:text-emerald-500 transition-all uppercase tracking-widest">+ 新增校正點 ADD POINT</button>
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
                    )}

                </div>
            </div>
        </div>
    );
};

export default PreSetup;
