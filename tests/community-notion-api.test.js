'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { notionConfig, toCommunityAsset, PUBLIC_LICENSES, NOTION_VERSION } = require('../api/community-assets')._test;

function notionPage(overrides = {}) {
  return {
    id: '421d38d6-eafa-811f-841b-d240d85dfd95',
    properties: {
      'Vật liệu': { title: [{ plain_text: 'NV02 – Tướng nhà Đường' }] },
      'Loại': { select: { name: 'Hình ảnh' } },
      'Vai trò': { multi_select: [{ name: 'Nhân vật' }] },
      'Trạng thái': { status: { name: 'Đã duyệt' } },
      'Giấy phép': { select: { name: 'Tự tạo' } },
      'Người tạo': { rich_text: [{ plain_text: 'Dola AI' }] },
      'Tệp Notion': { files: [{
        name: 'nhan_vat_2_tuong_dai_duong.jpeg',
        type: 'file',
        file: { url: 'https://prod-files-secure.s3.us-west-2.amazonaws.com/geed/image.jpeg?sig=fresh' }
      }] },
      'Ghi chú': { rich_text: [{ plain_text: 'Nhân vật AI tạo bằng Dola AI.' }] },
      'Từ khóa': { multi_select: [{ name: 'AI' }, { name: 'Geed' }] }
    },
    ...overrides
  };
}

test('community Notion endpoint uses the configured private token and data source', () => {
  assert.equal(notionConfig({ GEED_NOTION_API_TOKEN: 'secret' }).dataSourceId, '421d38d6-eafa-8116-8ec2-000bff1b1ed1');
  assert.equal(notionConfig({ GEED_NOTION_API_TOKEN: '', GEED_NOTION_DATA_SOURCE_ID: '421d38d6-eafa-8116-8ec2-000bff1b1ed1' }), null);
  assert.equal(NOTION_VERSION, '2026-03-11');
});

test('only approved assets with an allowed licence and an attached Notion file are published', () => {
  const asset = toCommunityAsset(notionPage());
  assert.equal(asset.title, 'NV02 – Tướng nhà Đường');
  assert.equal(asset.category, 'characters');
  assert.equal(asset.mediaType, 'image');
  assert.equal(asset.status, 'published');
  assert.equal(asset.supportsEditor, true);
  assert.equal(asset.author, 'Dola AI');
  assert.equal(asset.license, 'Tự tạo');
  assert.match(asset.url, /^https:\/\//);
  assert.equal(asset.id, '421d38d6eafa811f841bd240d85dfd95');

  const pending = notionPage({ properties: {
    'Vật liệu': { title: [{ plain_text: 'Pending' }] },
    'Trạng thái': { status: { name: 'Mới' } },
    'Giấy phép': { select: { name: 'Tự tạo' } }
  } });
  assert.equal(toCommunityAsset(pending), null);

  const unclearLicense = notionPage({ properties: {
    ...notionPage().properties,
    'Giấy phép': { select: { name: 'Chưa rõ' } }
  } });
  assert.equal(toCommunityAsset(unclearLicense), null);

  const noFile = notionPage({ properties: {
    ...notionPage().properties,
    'Tệp Notion': { files: [] }
  } });
  assert.equal(toCommunityAsset(noFile), null);
  assert.ok(PUBLIC_LICENSES.has('Được cấp phép'));
});
