'use strict';

const { getBearerToken, verifySupabaseUser, readConfig } = require('../../lib/supabase-ai-gateway');
const { buildMaterialPage, normalizeMaterial, plainText } = require('../../lib/notion-materials');

const DEFAULT_DATA_SOURCE_ID = '421d38d6-eafa-8116-8ec2-000bff1b1ed1';
const NOTION_VERSION = '2026-03-11';

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('vary', 'Authorization');
  res.end(JSON.stringify(payload));
}
function notionConfig(env = process.env) {
  const token = String(env.GEED_NOTION_API_TOKEN || '').trim();
  const dataSourceId = String(env.GEED_NOTION_DATA_SOURCE_ID || DEFAULT_DATA_SOURCE_ID).trim();
  if (!token || !/^[a-f0-9-]{32,36}$/i.test(dataSourceId)) return null;
  return { token, dataSourceId };
}
async function notionRequest(config, method, path, body) {
  const response = await fetch('https://api.notion.com/v1' + path, {
    method,
    headers: {
      authorization: 'Bearer ' + config.token,
      'notion-version': NOTION_VERSION,
      'content-type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('Notion API request failed.');
    error.status = response.status;
    error.notionCode = payload.code || '';
    throw error;
  }
  return payload;
}
async function currentUser(req) {
  const config = readConfig();
  if (!config) return null;
  const token = getBearerToken(req);
  if (!token) return null;
  try { return await verifySupabaseUser({ token, config }); }
  catch { return null; }
}
const UUID_OWNER_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function materialVisibleToUser(page, userId) {
  const id = String(userId || '').trim();
  if (!id) return false;
  const owner = plainText(page?.properties?.['Người tạo']).trim();
  // UUID values are private Supabase owner IDs. Text labels such as "Dola AI"
  // are creator/source attribution, not account IDs, so keep them visible.
  return !owner || owner === id || !UUID_OWNER_RE.test(owner);
}

function notionError(res, error) {
  if (error?.status === 401 || error?.status === 403 || error?.notionCode === 'object_not_found') {
    return send(res, 502, {
      error: 'Notion chưa cấp quyền cho Geed. Hãy chia sẻ bảng Thư viện vật liệu cho kết nối Geed và kiểm tra quyền đọc/ghi.',
      code: 'NOTION_ACCESS_NOT_GRANTED'
    });
  }
  return send(res, 502, {
    error: 'Không thể kết nối Notion lúc này. Vui lòng thử lại sau.',
    code: 'NOTION_API_UNAVAILABLE'
  });
}

module.exports = async function handler(req, res) {
  const notion = notionConfig();

  if (req.method === 'GET') {
    if (!notion) return send(res, 200, {
      notionAvailable: false, items: [],
      message: 'Notion chưa được cấu hình trong Geed.'
    });
    const user = await currentUser(req);
    if (!user) return send(res, 401, {
      notionAvailable: true, error: 'Hãy đăng nhập Google trong Geed trước.'
    });
    const cursor = String(req.query?.cursor || '').trim();
    if (cursor.length > 200) return send(res, 400, { error: 'Cursor không hợp lệ.' });
    try {
      const body = {
        page_size: 100,
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }]
      };
      if (cursor) body.start_cursor = cursor;
      const result = await notionRequest(notion, 'POST',
        '/data_sources/' + notion.dataSourceId + '/query', body);
      const items = (result.results || [])
        .filter(page => materialVisibleToUser(page, user.id))
        .map(normalizeMaterial);
      return send(res, 200, {
        notionAvailable: true,
        items,
        nextCursor: result.has_more ? result.next_cursor : null
      });
    } catch (error) {
      return notionError(res, error);
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed.' });
  }
  if (!notion) return send(res, 503, {
    error: 'Geed chưa được kết nối Notion. Cần thêm GEED_NOTION_API_TOKEN trong Vercel.',
    code: 'NOTION_NOT_CONFIGURED'
  });
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'Hãy đăng nhập Google trước khi lưu vật liệu.' });

  let body;
  try {
    body = req.body && typeof req.body === 'object'
      ? req.body : (typeof req.body === 'string' ? JSON.parse(req.body) : {});
  } catch {
    return send(res, 400, { error: 'Dữ liệu gửi lên không hợp lệ.' });
  }

  try {
    const payload = buildMaterialPage(body, user.id);
    payload.parent.data_source_id = notion.dataSourceId;
    const page = await notionRequest(notion, 'POST', '/pages', payload);
    return send(res, 201, {
      item: normalizeMaterial(page),
      notionAvailable: true,
      attachFileInNotion: true
    });
  } catch (error) {
    if (!error?.status && !error?.notionCode) {
      return send(res, 400, { error: error.message || 'Vật liệu chưa hợp lệ.' });
    }
    return notionError(res, error);
  }
};

module.exports._test = { notionConfig, materialVisibleToUser, NOTION_VERSION, DEFAULT_DATA_SOURCE_ID };
