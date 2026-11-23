'use strict';

const MATERIAL_TYPES = Object.freeze([
  'Video', 'Hình ảnh', 'Âm thanh', 'Giọng đọc', 'Nhạc',
  'Hiệu ứng âm thanh', 'Font', 'Texture', 'Mô hình 3D', 'Preset', 'Khác'
]);
const MATERIAL_ROLES = Object.freeze([
  'Bối cảnh', 'Nhân vật', 'Đạo cụ', 'Chuyển cảnh',
  'Âm thanh nền', 'Tiêu đề', 'Hiệu ứng', 'Khác'
]);
const LICENSES = Object.freeze(['Tự tạo', 'Được cấp phép', 'Miễn phí', 'Cần kiểm tra', 'Chưa rõ']);
const TAGS = Object.freeze(['Geed', 'Runway', 'Adobe', 'Canva', 'Video', 'Audio', 'AI']);

function cleanText(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function safeHttpsUrl(value, label) {
  const raw = cleanText(value, 2000);
  if (!raw) return null;
  let url;
  try { url = new URL(raw); } catch { throw new Error(label + ' phải là liên kết HTTPS hợp lệ.'); }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(label + ' phải là liên kết HTTPS công khai.');
  }
  return url.href;
}
function asRichText(value) {
  const text = cleanText(value, 1800);
  return text ? [{ type: 'text', text: { content: text } }] : [];
}
function buildMaterialPage(input = {}, userId) {
  const name = cleanText(input.name, 120);
  if (!name) throw new Error('Hãy nhập tên vật liệu.');
  const type = MATERIAL_TYPES.includes(input.type) ? input.type : 'Khác';
  const roles = Array.isArray(input.roles) ? input.roles.filter(v => MATERIAL_ROLES.includes(v)).slice(0, 8) : [];
  const tags = Array.isArray(input.tags) ? input.tags.filter(v => TAGS.includes(v)).slice(0, 7) : [];
  const license = LICENSES.includes(input.license) ? input.license : 'Chưa rõ';
  const sourceUrl = safeHttpsUrl(input.sourceUrl, 'Nguồn');
  const previewUrl = safeHttpsUrl(input.previewUrl, 'Link xem trước');
  const fileUrl = safeHttpsUrl(input.fileUrl, 'Link tệp gốc');
  const sizeMb = Number(input.sizeMb);
  const durationSeconds = Number(input.durationSeconds);

  return {
    parent: { data_source_id: undefined },
    properties: {
      'Vật liệu': { title: [{ type: 'text', text: { content: name } }] },
      'Loại': { select: { name: type } },
      'Vai trò': { multi_select: roles.map(name => ({ name })) },
      'Trạng thái': { status: { name: 'Mới' } },
      'Nguồn': { url: sourceUrl },
      'Link xem trước': { url: previewUrl },
      'Link tệp gốc': { url: fileUrl },
      'Định dạng': { rich_text: asRichText(input.format) },
      'Dung lượng MB': { number: Number.isFinite(sizeMb) && sizeMb > 0 ? Math.round(sizeMb * 100) / 100 : null },
      'Thời lượng giây': { number: Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.round(durationSeconds * 100) / 100 : null },
      'Độ phân giải': { rich_text: asRichText(input.resolution) },
      'Giấy phép': { select: { name: license } },
      'Từ khóa': { multi_select: tags.map(name => ({ name })) },
      'Ghi chú': { rich_text: asRichText(input.note) },
      'Người tạo': { rich_text: asRichText(userId) },
      'Lưu trữ': { select: { name: fileUrl ? 'External' : 'Notion' } }
    }
  };
}
function plainText(property) {
  const values = property?.title || property?.rich_text || [];
  return Array.isArray(values) ? values.map(item => item.plain_text || item.text?.content || '').join('') : '';
}
function notionFileInfo(property) {
  const files = Array.isArray(property?.files) ? property.files : [];
  const entry = files.find(file => file && (file.type === 'file' || file.type === 'external')) || null;
  if (!entry) return null;
  const source = entry.type === 'file' ? entry.file : entry.external;
  const url = source?.url || null;
  if (!url) return null;
  return {
    name: cleanText(entry.name || source?.name, 255),
    url,
    type: entry.type,
    expiryTime: source?.expiry_time || null
  };
}
function normalizeMaterial(page) {
  const p = page?.properties || {};
  const multi = name => Array.isArray(p[name]?.multi_select) ? p[name].multi_select.map(item => item.name) : [];
  const notionFile = notionFileInfo(p['Tệp Notion']);
  const fileUrl = notionFile?.url || p['Link tệp gốc']?.url || null;
  const previewUrl = p['Link xem trước']?.url || notionFile?.url || fileUrl;
  return {
    id: page?.id || '',
    url: page?.url || '',
    name: plainText(p['Vật liệu']),
    type: p['Loại']?.select?.name || 'Khác',
    roles: multi('Vai trò'),
    status: p['Trạng thái']?.status?.name || 'Mới',
    sourceUrl: p['Nguồn']?.url || null,
    previewUrl,
    fileUrl,
    notionFileName: notionFile?.name || null,
    notionFileExpiresAt: notionFile?.expiryTime || null,
    storage: notionFile ? 'Notion' : (fileUrl ? 'External' : (p['Lưu trữ']?.select?.name || 'Notion')),
    format: plainText(p['Định dạng']),
    sizeMb: p['Dung lượng MB']?.number ?? null,
    durationSeconds: p['Thời lượng giây']?.number ?? null,
    resolution: plainText(p['Độ phân giải']),
    license: p['Giấy phép']?.select?.name || 'Chưa rõ',
    tags: multi('Từ khóa'),
    note: plainText(p['Ghi chú']),
    createdAt: page?.created_time || null
  };
}
module.exports = { MATERIAL_TYPES, MATERIAL_ROLES, LICENSES, TAGS, buildMaterialPage, normalizeMaterial, plainText, notionFileInfo };
