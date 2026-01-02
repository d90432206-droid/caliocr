import React, { useState, useMemo } from 'react';
import { getRecordsByQuotation, CalibrationRecord } from '../services/supabaseService';

interface Props {
    onBack: () => void;
    initialQuotationNo?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
    dc_voltage: '直流電壓 DCV',
    dc_current: '直流電流 DCA',
    ac_voltage: '交流電壓 ACV',
    ac_current: '交流電流 ACA',
    resistance: '電阻 Resistance',
    power: '電功率 Power',
    temperature: '溫度記錄 Temp',
    pressure: '壓力數值 Press',
    diff_pressure: '差壓 Diff Press',
    digital_pressure: '數字壓力計 Digital',
    'Identity Photo': '銘牌照片'
};

const CalibrationHistory: React.FC<Props> = ({ onBack, initialQuotationNo }) => {
    const [quotationNo, setQuotationNo] = useState(initialQuotationNo || '');
    const [records, setRecords] = useState<CalibrationRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // UI State
    const [selectedQuotation, setSelectedQuotation] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>('ALL');
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const handleSearch = async () => {
        setIsLoading(true);
        setSelectedQuotation(null); // Reset selection on new search
        try {
            const data = await getRecordsByQuotation(quotationNo.trim());
            setRecords(data);
        } catch (err) {
            alert('查詢失敗，請稍後再試');
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        handleSearch();
    }, [initialQuotationNo]);

    // Group records by Quotation Number
    const groupedQuotations = useMemo(() => {
        const groups: Record<string, { count: number, date: string, items: number }> = {};
        records.forEach(r => {
            if (!groups[r.quotation_no]) {
                groups[r.quotation_no] = { count: 0, date: r.created_at, items: 0 };
            }
            groups[r.quotation_no].count++;
            // Update to latest date
            if (new Date(r.created_at) > new Date(groups[r.quotation_no].date)) {
                groups[r.quotation_no].date = r.created_at;
            }
        });
        return groups;
    }, [records]);

    // Filter records for the selected quotation
    const activeRecords = useMemo(() => {
        if (!selectedQuotation) return [];
        return records.filter(r => r.quotation_no === selectedQuotation);
    }, [records, selectedQuotation]);

    // Get available tabs (Measurement Types) for active records
    const availableTabs = useMemo(() => {
        const types = new Set(activeRecords.map(r => r.reading_type));
        return ['ALL', ...Array.from(types)];
    }, [activeRecords]);

    // Filter by Tab
    const displayRecords = useMemo(() => {
        if (activeTab === 'ALL') return activeRecords;
        return activeRecords.filter(r => r.reading_type === activeTab);
    }, [activeRecords, activeTab]);

    const exportToCSV = () => {
        if (displayRecords.length === 0) return;

        const headers = ['報價單號', '案號/設備ID', '廠牌', '型號', '序號', '量測類型', '標準值', '實測值', '單位', '照片網址', '建立時間'];
        const csvContent = [
            headers.join(','),
            ...displayRecords.map(r => [
                `"${r.quotation_no}"`,
                `"${r.equipment_id}"`,
                `"${r.maker}"`,
                `"${r.model}"`,
                `"${r.serial_number}"`,
                `"${CATEGORY_LABELS[r.reading_type] || r.reading_type}"`,
                `"${r.standard_value || ''}"`,
                `"${r.value}"`,
                `"${r.unit}"`,
                `"${r.image_url || ''}"`,
                `"${new Date(r.created_at).toLocaleString()}"`
            ].join(','))
        ].join('\n');

        const fileName = `${selectedQuotation}_${activeTab === 'ALL' ? 'full' : activeTab}_export.csv`;
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex-grow flex flex-col p-6 lg:p-12 overflow-y-auto bg-slate-950">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => {
                        if (selectedQuotation) {
                            setSelectedQuotation(null);
                        } else {
                            onBack(); // Clear session handled by parent
                        }
                    }} className="p-3 bg-slate-900 rounded-2xl border border-slate-800 hover:bg-slate-800 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h2 className="text-3xl font-black italic tracking-tight text-white uppercase">記錄查詢系統</h2>
                        <p className="text-slate-500 text-xs font-bold tracking-widest uppercase">
                            {selectedQuotation ? `報價單：${selectedQuotation}` : 'Calibration History Explorer'}
                        </p>
                    </div>
                </div>

                {!selectedQuotation && (
                    <div className="flex gap-3">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="輸入報價單號..."
                                value={quotationNo}
                                onChange={(e) => setQuotationNo(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl text-white font-bold focus:border-emerald-500 outline-none min-w-[300px] shadow-2xl"
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="px-8 py-4 bg-emerald-500 text-black font-black rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isLoading ? '搜尋中...' : (quotationNo ? '搜尋' : '顯示最近 50 筆')}
                        </button>
                    </div>
                )}

                {selectedQuotation && (
                    <button
                        onClick={exportToCSV}
                        className="px-6 py-4 bg-emerald-500 text-black font-black rounded-2xl shadow-lg active:scale-95 transition-all flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        匯出此頁 ({activeTab})
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex-grow flex flex-col relative">

                {/* View 1: Quotation List */}
                {!selectedQuotation && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-900/80">
                                    <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">報價單號 Quotation No.</th>
                                    <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">最近更新 Last Updated</th>
                                    <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">記錄筆數 Records</th>
                                    <th className="p-6"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {Object.keys(groupedQuotations).length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-20 text-center text-slate-500 font-bold">
                                            {isLoading ? '正在載入...' : '尚無相關記錄'}
                                        </td>
                                    </tr>
                                ) : (
                                    Object.entries(groupedQuotations).map(([qNo, info]) => (
                                        <tr key={qNo} onClick={() => { setSelectedQuotation(qNo); setActiveTab('ALL'); }} className="hover:bg-white/5 transition-colors cursor-pointer group">
                                            <td className="p-6 text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">{qNo}</td>
                                            <td className="p-6 text-slate-400 font-mono text-sm">{new Date(info.date).toLocaleString()}</td>
                                            <td className="p-6 text-right font-black text-lg text-slate-300">{info.count}</td>
                                            <td className="p-6 text-right">
                                                <svg className="w-6 h-6 text-slate-600 group-hover:text-emerald-500 transition-colors inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* View 2: Quotation Detail with Tabs */}
                {selectedQuotation && (
                    <div className="flex flex-col h-full">
                        {/* Tabs */}
                        <div className="flex overflow-x-auto p-2 gap-2 bg-slate-900/80 border-b border-slate-800 scrollbar-hide">
                            {availableTabs.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-6 py-3 rounded-xl text-xs font-black tracking-widest uppercase transition-all whitespace-nowrap ${activeTab === tab
                                        ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                                        }`}
                                >
                                    {CATEGORY_LABELS[tab] || tab}
                                </button>
                            ))}
                        </div>

                        {/* List */}
                        <div className="flex-grow overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-800 bg-slate-900/50 sticky top-0 backdrop-blur-md">
                                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">設備/型號</th>
                                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">序號</th>
                                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">量測類型</th>
                                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">標準值</th>
                                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">實測數值</th>
                                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">照片</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {displayRecords.map((record) => (
                                        <tr key={record.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-6">
                                                <div className="text-white font-bold">{record.equipment_id}</div>
                                                <div className="text-[10px] text-slate-500 font-medium uppercase">{record.maker} {record.model}</div>
                                            </td>
                                            <td className="p-6">
                                                <span className="text-sm font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded border border-slate-700">{record.serial_number}</span>
                                            </td>
                                            <td className="p-6">
                                                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-lg border border-emerald-500/20 uppercase tracking-wider">
                                                    {CATEGORY_LABELS[record.reading_type] || record.reading_type}
                                                </span>
                                            </td>
                                            <td className="p-6 text-xl font-bold text-slate-400">
                                                {record.standard_value === 'N/A' ? '--' : record.standard_value}
                                            </td>
                                            <td className="p-6 text-2xl font-black text-white italic">
                                                {record.value} <span className="text-xs text-slate-500 font-medium not-italic ml-1">{record.unit}</span>
                                            </td>
                                            <td className="p-6 text-right">
                                                {record.image_url || record.image_base64 ? (
                                                    <button
                                                        onClick={() => setPreviewImage(record.image_url || record.image_base64)}
                                                        className="inline-flex items-center justify-center w-12 h-12 bg-slate-800 rounded-xl overflow-hidden hover:ring-2 hover:ring-emerald-500 transition-all shadow-xl"
                                                    >
                                                        <img src={record.image_url || record.image_base64} className="w-full h-full object-cover" alt="Calibration" />
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] text-slate-700 font-black italic">NO IMAGE</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Lightbox Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-full max-h-full">
                        <img
                            src={previewImage}
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            alt="Full Preview"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white"
                        >
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalibrationHistory;
