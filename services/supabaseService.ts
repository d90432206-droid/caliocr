import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (!supabase) {
  console.warn("Supabase 尚未設定 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY，部分功能可能無法運作。");
}

export interface CalibrationRecord {
  id?: string;
  customer_name: string;
  equipment_id: string; // 案號
  quotation_no: string;
  // 設備細節
  maker: string;
  model: string;
  serial_number: string;
  // 讀數細節
  reading_type: string;
  standard_value: string; // 標準值 (目標值)
  value: string;          // 實測值
  unit: string;
  image_url?: string;
  image_base64?: string; // 用於上傳前的暫存
  created_at: string;
}

export const saveCalibrationRecord = async (record: CalibrationRecord) => {
  if (!supabase) {
    console.error("Supabase 未設定，無法儲存紀錄。");
    return { success: false, error: "Supabase configuration missing" };
  }
  console.log("正在將紀錄與照片存儲至 Supabase:", record.equipment_id, record.value);

  let imageUrl = '';

  // 1. 如果有圖片，先上傳到 Storage
  if (record.image_base64) {
    const fileName = `${record.quotation_no}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const base64Data = record.image_base64.split(',')[1];
    const blob = await fetch(`data:image/jpeg;base64,${base64Data}`).then(res => res.blob());

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, blob, { contentType: 'image/jpeg' });

    if (uploadError) {
      console.error("圖片上傳失敗:", uploadError);
    } else {
      // 獲取公開 URL (假設 bucket 是公開的)
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);
      imageUrl = publicUrl;
    }
  }

  // 2. 插入資料到資料庫
  const { data, error } = await supabase
    .from('readings')
    .insert([{
      customer_name: record.customer_name,
      equipment_id: record.equipment_id,
      quotation_no: record.quotation_no,
      maker: record.maker,
      model: record.model,
      serial_number: record.serial_number,
      reading_type: record.reading_type,
      standard_value: record.standard_value,
      value: record.value,
      unit: record.unit,
      image_url: imageUrl,
      created_at: record.created_at
    }])
    .select();

  if (error) {
    console.error("資料存儲失敗:", error);
    throw error;
  }

  return { success: true, data };
};

export const getRecordsByQuotation = async (quotationNo: string): Promise<CalibrationRecord[]> => {
  if (!supabase) {
    console.error("Supabase 未設定，無法獲取紀錄。");
    return [];
  }

  let query = supabase
    .from('readings')
    .select('*');

  if (quotationNo && quotationNo.trim()) {
    query = query.ilike('quotation_no', quotationNo.trim());
  } else {
    // 如果沒有輸入單號，顯示最近 50 筆
    query = query.limit(50);
  }

  // 預設按時間倒序 (最新的在上面)
  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error("獲取紀錄失敗:", error);
    throw error;
  }

  return data as CalibrationRecord[];
};
