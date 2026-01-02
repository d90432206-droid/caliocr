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
  frequency?: string; // 頻率 (AC/Power only)
  environment_temp?: string; // 環境溫度
  environment_humidity?: string; // 環境濕度
  std_maker?: string;
  std_model?: string;
  std_serial?: string;
  std_unit?: string;
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

  // 1. 直接將 Base64 存入 image_url (避免 Storage Bucket 設定問題)
  // 由於圖片已在前端壓縮 (800px, 0.6 quality)，大小約為 30-80KB，直接存入資料庫是可行且最穩定的。
  if (record.image_base64) {
    imageUrl = record.image_base64;
  }

  /* 
  // 舊的 Storage 上傳邏輯 (暫時停用以確保穩定性)
  if (record.image_base64) {
    // ...
  } 
  */

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
      frequency: record.frequency,
      environment_temp: record.environment_temp,
      environment_humidity: record.environment_humidity,
      std_maker: record.std_maker,
      std_model: record.std_model,
      std_serial: record.std_serial,
      std_unit: record.std_unit,
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
