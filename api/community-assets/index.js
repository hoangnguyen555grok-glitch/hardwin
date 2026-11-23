'use strict';

const { normalizeMaterial, plainText } = require('../../lib/notion-materials');

const DEFAULT_DATA_SOURCE_ID = '421d38d6-eafa-8116-8ec2-000bff1b1ed1';
const NOTION_VERSION = '2026-03-11';
const PUBLIC_LICENSES = new Set(['Tự tạo', 'Được cấp phép', 'Miễn phí']);
const CATEGORY_BY_ROLE = Object.freeze({
  'Bối cảnh': 'backgrounds',
  'Nhân vật': 'characters',
  'Đạo cụ': 'props',
  'Chuyển cảnh': 'effects',
  'Âm thanh nền': 'audio',
  'Hiệu ứng': 'effects',
  'Tiêu đề': 'fonts'
});

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store, max-age=0');
  res.setHeader('vary', 'Accept');
  res.end(JSON.stringify(payload));
}

function notionConfig(env = process.env) {
  const token = String(env.GEED_NOTION_API_TOKEN || '').trim();
  const dataSourceId = String(env.GEED_NOTION_DATA_SOURCE_ID || DEFAULT_DATA_SOURCE_ID).trim();
  if (!token || !/^[a-f0-9-]{32,36}$/i.test(dataSourceId)) return null;
  return { token, dataSourceId };
}

async function notionRequest(config, path, body) {
  const response = await fetch('https://api.notion.com/v1' + path, {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + config.token,
      'notion-version': NOTION_VERSION,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body),
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

function toCommunityAsset(page) {
  const properties = page?.properties || {};
  const status = properties['Trạng thái']?.status?.name || '';
  const license = properties['Giấy phép']?.select?.name || '';
  if (status !== 'Đã duyệt' || !PUBLIC_LICENSES.has(license)) return null;

  const material = normalizeMaterial(page);
  if (!material.name || !material.fileUrl) return null;
  let url;
  try {
    url = new URL(material.fileUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
  } catch {
    return null;
  }

  const mediaType = material.type === 'Video' ? 'video'
    : material.type === 'Font' ? 'font'
    : ['Âm thanh', 'Giọng đọc', 'Nhạc', 'Hiệu ứng âm thanh'].includes(material.type) ? 'audio'
    : ['Hình ảnh', 'Texture', 'Mô hình 3D', 'Preset'].includes(material.type) ? 'image'
    : null;
  if (!mediaType) return null;

  const roles = Array.isArray(material.roles) ? material.roles : [];
  const category = roles.map(role => CATEGORY_BY_ROLE[role]).find(Boolean)
    || (mediaType === 'audio' ? 'audio' : mediaType === 'font' ? 'fonts' : 'props');
  const creator = plainText(properties['Người tạo']).trim();
  const creatorIsAccountId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creator);
  const author = creator && !creatorIsAccountId ? creator : 'Geed Hardwin';
  const id = String(page?.id || '').replace(/[^a-f0-9]/gi, '');
  if (!id) return null;

  return {
    id,
    title: material.name.slice(0, 120),
    category,
    mediaType,
    url: url.href,
    thumbnailUrl: mediaType === 'image' ? url.href : null,
    description: material.note || '',
    tags: material.tags || [],
    author,
    license,
    attribution: author,
    supportsEditor: ['image', 'audio'].includes(mediaType),
    status: 'published'
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return send(res, 405, { error: 'Method not allowed.' });
  }
  const notion = notionConfig();
  if (!notion) return send(res, 503, {
    error: 'Geed community library is not connected to Notion.',
    code: 'NOTION_NOT_CONFIGURED',
    assets: []
  });

  try {
    const assets = [];
    let cursor = null;
    let pagesRead = 0;
    do {
      const body = {
        page_size: 100,
        filter: { property: 'Trạng thái', status: { equals: 'Đã duyệt' } },
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }]
      };
      if (cursor) body.start_cursor = cursor;
      const result = await notionRequest(
        notion,
        '/data_sources/' + notion.dataSourceId + '/query',
        body
      );
      for (const page of result.results || []) {
        const asset = toCommunityAsset(page);
        if (asset) assets.push(asset);
      }
      cursor = result.has_more ? result.next_cursor : null;
      pagesRead += 1;
    } while (cursor && pagesRead < 5);

    return send(res, 200, {
      assets: assets.slice(0, 500),
      updatedAt: new Date().toISOString(),
      source: 'notion',
      truncated: Boolean(cursor)
    });
  } catch (error) {
    const accessDenied = error?.status === 401 || error?.status === 403 || error?.notionCode === 'object_not_found';
    return send(res, 502, {
      error: accessDenied
        ? 'Notion has not granted Geed access to the material database.'
        : 'Could not load the Notion community library right now.',
      code: accessDenied ? 'NOTION_ACCESS_NOT_GRANTED' : 'NOTION_API_UNAVAILABLE',
      assets: []
    });
  }
};

module.exports._test = { notionConfig, toCommunityAsset, PUBLIC_LICENSES, NOTION_VERSION };
