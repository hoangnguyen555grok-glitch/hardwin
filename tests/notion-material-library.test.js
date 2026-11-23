'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMaterialPage, normalizeMaterial, MATERIAL_TYPES } = require('../lib/notion-materials');
const { notionConfig, materialQueryFilter, DEFAULT_DATA_SOURCE_ID, NOTION_VERSION } = require('../api/materials')._test;

test('Notion materials use the created data source and current API version', () => {
  assert.equal(notionConfig({ GEED_NOTION_API_TOKEN: 'secret' }).dataSourceId, DEFAULT_DATA_SOURCE_ID);
  assert.equal(notionConfig({ GEED_NOTION_API_TOKEN: 'secret', GEED_NOTION_DATA_SOURCE_ID: 'invalid' }), null);
  assert.equal(NOTION_VERSION, '2026-03-11');
});

test('Notion query includes the signed-in user materials and manually-added shared rows', () => {
  const userId = '12345678-1234-1234-1234-123456789abc';
  const filter = materialQueryFilter(userId);
  assert.equal(filter.or.length, 2);
  assert.equal(filter.or[0].property, 'Người tạo');
  assert.equal(filter.or[0].rich_text.equals, userId);
  assert.equal(filter.or[1].property, 'Người tạo');
  assert.equal(filter.or[1].rich_text.is_empty, true);
});

test('material pages keep metadata and owner identity in Notion without storing binary files in GitHub or R2', () => {
  const userId = '12345678-1234-1234-1234-123456789abc';
  const page = buildMaterialPage({
    name: 'Forest ambience', type: 'Âm thanh', roles: ['Âm thanh nền', 'not-allowed'],
    license: 'Tự tạo', tags: ['Geed', 'Audio', 'bad'],
    format: 'WAV', sizeMb: 2.4, durationSeconds: 5,
    sourceUrl: 'https://example.com/source', note: 'Soft ambience'
  }, userId);
  assert.equal(page.properties['Vật liệu'].title[0].text.content, 'Forest ambience');
  assert.equal(page.properties['Loại'].select.name, 'Âm thanh');
  assert.deepEqual(page.properties['Vai trò'].multi_select.map(v => v.name), ['Âm thanh nền']);
  assert.equal(page.properties['Lưu trữ'].select.name, 'Notion');
  assert.equal(page.properties['Người tạo'].rich_text[0].text.content, userId);
  assert.equal(page.properties['Dung lượng MB'].number, 2.4);
  assert.deepEqual(page.properties['Từ khóa'].multi_select.map(v => v.name), ['Geed', 'Audio']);
  assert.equal(Object.hasOwn(page.properties, 'R2 Object key'), false);
  assert.equal(Object.hasOwn(page.properties, 'Tệp Notion'), false);
});

test('external material links must be HTTPS and are marked as external', () => {
  const page = buildMaterialPage({
    name: 'Reference', type: 'Video', fileUrl: 'https://cdn.example.com/a.mp4',
    sourceUrl: 'https://example.com/source'
  }, '12345678-1234-1234-1234-123456789abc');
  assert.equal(page.properties['Link tệp gốc'].url, 'https://cdn.example.com/a.mp4');
  assert.equal(page.properties['Nguồn'].url, 'https://example.com/source');
  assert.equal(page.properties['Lưu trữ'].select.name, 'External');
  assert.throws(() => buildMaterialPage({ name: 'Unsafe', fileUrl: 'http://example.com/a' }, '12345678-1234-1234-1234-123456789abc'), /HTTPS/);
});

test('material response reads a Notion-hosted file and its time-limited URL', () => {
  const result = normalizeMaterial({
    id: 'page-1', url: 'https://notion.so/page-1', created_time: '2026-11-23T10:00:00Z',
    properties: {
      'Vật liệu': { title: [{ plain_text: 'Skyline' }] },
      'Loại': { select: { name: 'Hình ảnh' } },
      'Vai trò': { multi_select: [{ name: 'Bối cảnh' }] },
      'Trạng thái': { status: { name: 'Mới' } },
      'Giấy phép': { select: { name: 'Được cấp phép' } },
      'Tệp Notion': { files: [{
        name: 'skyline.png',
        type: 'file',
        file: { url: 'https://prod-files-secure.s3.us-west-2.amazonaws.com/file.png?signature=fresh', expiry_time: '2026-11-23T11:00:00Z' }
      }] },
      'Dung lượng MB': { number: 1.5 }
    }
  });
  assert.equal(result.name, 'Skyline');
  assert.equal(result.type, 'Hình ảnh');
  assert.equal(result.sizeMb, 1.5);
  assert.equal(result.previewUrl, 'https://prod-files-secure.s3.us-west-2.amazonaws.com/file.png?signature=fresh');
  assert.equal(result.fileUrl, result.previewUrl);
  assert.equal(result.notionFileName, 'skyline.png');
  assert.equal(result.notionFileExpiresAt, '2026-11-23T11:00:00Z');
  assert.equal(result.storage, 'Notion');
  assert.ok(MATERIAL_TYPES.includes(result.type));
});

test('material response supports external files and empty Notion attachments', () => {
  const external = normalizeMaterial({
    properties: {
      'Vật liệu': { title: [{ plain_text: 'External clip' }] },
      'Link tệp gốc': { url: 'https://cdn.example.com/clip.mp4' },
      'Tệp Notion': { files: [] }
    }
  });
  assert.equal(external.fileUrl, 'https://cdn.example.com/clip.mp4');
  assert.equal(external.storage, 'External');
  const empty = normalizeMaterial({ properties: { 'Vật liệu': { title: [{ plain_text: 'No file yet' }] } } });
  assert.equal(empty.fileUrl, null);
  assert.equal(empty.notionFileName, null);
});
