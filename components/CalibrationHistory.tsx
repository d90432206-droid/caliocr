import React, { useState } from 'react';
import { getRecordsByQuotation, CalibrationRecord } from '../services/supabaseService';

interface Props {
    onBack: () => void;
    initialQuotationNo?: string;
}

// 定義 CSV 欄位
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
    digital_pressure: '數字壓力計 Digital'
};

const CalibrationHistory: React.FC<Props> = ({ onBack, initialQuotationNo }) => {
    const [quotationNo, setQuotationNo] = useState(initialQuotationNo || '');
    const [records, setRecords] = useState<CalibrationRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (!quotationNo.trim()) return;
        setIsLoading(true);
        setHasSearched(true);
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
        if (initialQuotationNo) {
            handleSearch();
        }
    }, [initialQuotationNo]);

    const exportToCSV = () => {
        if (records.length === 0) return;

        // --- 模式 1: 原始資料清單 ---
        const headers = ['報價單號', '案號/設備ID', '廠牌', '型號', '序號', '量測類型', '標準值', '實測值', '單位', '照片網址', '建立時間'];
        const csvContent = [
            headers.join(','),
            ...records.map(r => [
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

        downloadCSV(csvContent, `full_data_${quotationNo || 'export'}.csv`);
    };

    const exportPasteFriendlyCSV = () => {
        if (records.length === 0) return;

        // 將資料按類別與標準值分組 (以利 Excel 貼上)
        // 格式: 類別, 標準值, 測試 1, 測試 2, 測試 3, ...
        const groupedMap: Record<string, Record<string, string[]>> = {};

        records.forEach(r => {
            const typeLabel = CATEGORY_LABELS[r.reading_type] || r.reading_type;
            const stdVal = r.standard_value || '0';
            if (!groupedMap[typeLabel]) groupedMap[typeLabel] = {};
            if (!groupedMap[typeLabel][stdVal]) groupedMap[typeLabel][stdVal] = [];
            groupedMap[typeLabel][stdVal].push(r.value);
        });

        const rows: string[] = [];
        rows.push('類別,標準值,讀值1,讀值2,讀值3,讀值4,讀值5,讀值6');

        Object.keys(groupedMap).forEach(type => {
            Object.keys(groupedMap[type]).forEach(std => {
                const readings = groupedMap[type][std];
                const row = [
                    `"${type}"`,
                    `"${std}"`,
                    ...readings.map(v => `"${v}"`)
                ];
                rows.push(row.join(','));
            });
        });

        downloadCSV(rows.join('\n'), `excel_paste_${quotationNo || 'export'}.csv`);
    };

    const downloadCSV = (content: string, fileName: string) => {
        const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex-grow flex flex-col p-6 lg:p-12 overflow-y-auto">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-slate-900 rounded-2xl border border-slate-800 hover:bg-slate-800 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h2 className="text-3xl font-black italic tracking-tight text-white uppercase">記錄查詢系統</h2>
                        <p className="text-slate-500 text-xs font-bold tracking-widest uppercase">Calibration History Explorer</p>
                    </div>
                </div>

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
                        {isLoading ? '搜尋中...' : '搜尋'}
                    </button>

                    {records.length > 0 && (
                        <div className="flex gap-2">
                            <button
                                onClick={exportToCSV}
                                className="px-6 py-4 bg-slate-800 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all flex items-center gap-2 border border-slate-700 hover:bg-slate-700"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                原始 CSV
                            </button>
                            <button
                                onClick={exportPasteFriendlyCSV}
                                className="px-6 py-4 bg-white text-black font-black rounded-2xl shadow-lg active:scale-95 transition-all flex items-center gap-2 hover:bg-emerald-50"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                Excel 貼上格式
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex-grow flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/80">
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">設備/型號</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">序號</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">量測類型</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">標準值</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">實測數值</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">校正時間</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">照片</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {records.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-20 text-center">
                                        {hasSearched ? (
                                            <div className="flex flex-col items-center">
                                                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                                    <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                </div>
                                                <p className="text-slate-400 font-bold">查無任何校正紀錄</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                                                    <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                </div>
                                                <p className="text-slate-500 font-medium">請輸入報價單號並點擊搜尋</p>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                records.map((record) => (
                                    <tr key={record.id} className="hover:bg-white/5 transition-colors group">
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
                                            {record.standard_value || '--'}
                                        </td>
                                        <td className="p-6 text-2xl font-black text-white italic">
                                            {record.value} <span className="text-xs text-slate-500 font-medium not-italic ml-1">{record.unit}</span>
                                        </td>
                                        <td className="p-6">
                                            <div className="text-xs text-slate-400 font-bold">{new Date(record.created_at).toLocaleDateString()}</div>
                                            <div className="text-[10px] text-slate-600">{new Date(record.created_at).toLocaleTimeString()}</div>
                                        </td>
                                        <td className="p-6 text-right">
                                            {record.image_url ? (
                                                <a
                                                    href={record.image_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center justify-center w-12 h-12 bg-slate-800 rounded-xl overflow-hidden hover:ring-2 hover:ring-emerald-500 transition-all shadow-xl"
                                                >
                                                    <img src={record.image_url} className="w-full h-full object-cover" alt="Calibration" />
                                                </a>
                                            ) : (
                                                <span className="text-[10px] text-slate-700 font-black italic">NO IMAGE</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CalibrationHistory;
