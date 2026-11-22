'use strict';

(() => {
  const categories = Object.freeze({
    all: 'Tất cả vật liệu',
    backgrounds: 'Bối cảnh',
    characters: 'Nhân vật',
    props: 'Đạo cụ',
    audio: 'Âm thanh',
    effects: 'Hiệu ứng',
    fonts: 'Font chữ'
  });
  const categoryLabels = Object.freeze({
    backgrounds:'Bối cảnh',characters:'Nhân vật',props:'Đạo cụ',
    audio:'Âm thanh',effects:'Hiệu ứng',fonts:'Font chữ'
  });
  const mediaLabels = Object.freeze({image:'Hình ảnh',audio:'Âm thanh',video:'Video',font:'Font chữ'});
  const searchInput = document.getElementById('librarySearch');
  const filterButtons = [...document.querySelectorAll('[data-category]')];
  const resultsTitle = document.getElementById('resultsTitle');
  const resultsCount = document.getElementById('resultsCount');
  const assetTotal = document.getElementById('assetTotal');
  const assetGrid = document.getElementById('assetGrid');
  const emptyState = document.getElementById('emptyState');
  const emptyTitle = document.getElementById('emptyTitle');
  const emptyDescription = document.getElementById('emptyDescription');
  const emptyFootnote = document.getElementById('emptyFootnote');
  const submitDialog = document.getElementById('assetSubmitDialog');
  const submitForm = document.getElementById('assetSubmitForm');

  if (!searchInput || !resultsTitle || !resultsCount || !assetTotal || !assetGrid) return;

  let communityAssets = [];
  let activeCategory = 'all';

  function safePublicUrl(raw) {
    let url;
    try { url = new URL(String(raw || '')); } catch { return null; }
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' ||
        /^10\\./.test(host) || /^192\\.168\\./.test(host) || /^169\\.254\\./.test(host) ||
        /^172\\.(1[6-9]|2[0-9]|3[01])\\./.test(host)) return null;
    return url.href;
  }

  function normalizeAsset(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(String(raw.id || ''))) return null;
    if (typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 120) return null;
    if (!Object.hasOwn(categoryLabels, raw.category)) return null;
    if (!Object.hasOwn(mediaLabels, raw.mediaType)) return null;
    if (raw.status !== 'published') return null;
    const url = safePublicUrl(raw.url);
    if (!url) return null;
    const thumbnailUrl = raw.thumbnailUrl ? safePublicUrl(raw.thumbnailUrl) : null;
    return {
      id: raw.id,
      title: raw.title.trim(),
      category: raw.category,
      mediaType: raw.mediaType,
      url,
      thumbnailUrl,
      description: String(raw.description || '').slice(0, 600),
      tags: Array.isArray(raw.tags) ? raw.tags.filter(tag => typeof tag === 'string').slice(0, 12) : [],
      author: String(raw.author || 'Chưa ghi tác giả').slice(0, 100),
      license: String(raw.license || 'Chưa ghi giấy phép').slice(0, 100),
      attribution: String(raw.attribution || raw.author || '').slice(0, 180),
      supportsEditor: raw.supportsEditor === true && ['image','audio'].includes(raw.mediaType)
    };
  }

  function addText(parent, tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = String(value || '');
    parent.appendChild(node);
    return node;
  }

  function createMedia(asset) {
    const wrap = document.createElement('div');
    wrap.className = 'asset-media';
    if (asset.mediaType === 'image') {
      const img = document.createElement('img');
      img.src = asset.thumbnailUrl || asset.url;
      img.alt = asset.title;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => {
        img.remove();
        addText(wrap,'div','asset-media-placeholder','▧');
      };
      wrap.appendChild(img);
    } else if (asset.mediaType === 'audio') {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'none';
      audio.src = asset.url;
      audio.crossOrigin = 'anonymous';
      wrap.appendChild(audio);
      addText(wrap,'div','asset-media-placeholder','♫');
    } else if (asset.mediaType === 'video') {
      const video = document.createElement('video');
      video.controls = true;
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.src = asset.url;
      video.crossOrigin = 'anonymous';
      wrap.appendChild(video);
    } else {
      addText(wrap,'div','asset-media-placeholder','Aa');
    }
    return wrap;
  }

  function createCard(asset) {
    const card = document.createElement('article');
    card.className = 'asset-card';
    card.appendChild(createMedia(asset));
    const content = document.createElement('div');
    content.className = 'asset-content';
    const tags = document.createElement('div');
    tags.className = 'asset-tags';
    addText(tags,'span','asset-tag',categoryLabels[asset.category]);
    addText(tags,'span','asset-tag',mediaLabels[asset.mediaType]);
    content.appendChild(tags);
    addText(content,'h4','',asset.title);
    addText(content,'p','',asset.description || 'Tài nguyên do cộng đồng đóng góp.');
    const credit = document.createElement('div');
    credit.className = 'asset-credit';
    addText(credit,'span','',asset.attribution || asset.author);
    addText(credit,'span','',asset.license);
    content.appendChild(credit);
    const actions = document.createElement('div');
    actions.className = 'asset-actions';
    const use = document.createElement('button');
    use.type = 'button';
    use.textContent = asset.supportsEditor
      ? 'Dùng trong editor'
      : (asset.mediaType === 'video' ? 'Chưa hỗ trợ timeline' : 'Chỉ xem trước');
    use.disabled = !asset.supportsEditor;
    use.addEventListener('click', () => transferToEditor(asset));
    actions.appendChild(use);
    const open = document.createElement('a');
    open.href = asset.url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = 'Mở nguồn';
    actions.appendChild(open);
    content.appendChild(actions);
    card.appendChild(content);
    return card;
  }

  function transferToEditor(asset) {
    if (!asset.supportsEditor) return;
    try {
      sessionStorage.setItem('geedCommunityAssetHandoff', asset.id);
      window.location.assign('/');
    } catch {
      window.alert('Trình duyệt không cho phép chuyển vật liệu sang editor. Hãy bật session storage rồi thử lại.');
    }
  }

  function render() {
    const query = searchInput.value.trim().toLocaleLowerCase('vi');
    const matched = communityAssets.filter(asset => {
      const categoryMatches = activeCategory === 'all' || asset.category === activeCategory;
      const searchable = [asset.title,asset.description,asset.author,asset.license,...asset.tags]
        .filter(Boolean).join(' ').toLocaleLowerCase('vi');
      return categoryMatches && (!query || searchable.includes(query));
    });
    const categoryName = categories[activeCategory] || categories.all;
    resultsTitle.textContent = categoryName;
    resultsCount.textContent = query ? matched.length+' kết quả phù hợp' : matched.length+' tài nguyên';
    assetTotal.textContent = String(communityAssets.length);
    assetGrid.replaceChildren();
    matched.forEach(asset => assetGrid.appendChild(createCard(asset)));
    emptyState.hidden = matched.length > 0;

    if (matched.length) return;
    if (query) {
      emptyTitle.textContent = 'Chưa có kết quả phù hợp';
      emptyDescription.textContent = 'Hãy thử từ khóa khác hoặc đổi danh mục. Kho chỉ hiển thị các tài nguyên đã được duyệt.';
      emptyFootnote.textContent = 'Từ khóa: '+searchInput.value.trim();
    } else if (activeCategory !== 'all') {
      emptyTitle.textContent = 'Danh mục '+categoryName.toLocaleLowerCase('vi')+' đang chờ nội dung';
      emptyDescription.textContent = 'Danh mục đã sẵn sàng. Các tài nguyên sẽ xuất hiện sau khi đường dẫn và quyền sử dụng được kiểm tra.';
      emptyFootnote.textContent = 'Chưa có vật liệu được duyệt ở danh mục này';
    } else {
      emptyTitle.textContent = 'Kho cộng đồng đang chờ những vật liệu đầu tiên';
      emptyDescription.textContent = 'Kho đang trống. Trước mắt chúng ta sẽ tự bổ sung những cảnh nền, nhân vật, đạo cụ và âm thanh do mình chọn; cộng đồng có thể đề xuất liên kết công khai để chủ kho duyệt.';
      emptyFootnote.textContent = '0 tệp được lưu trên Geed · Danh mục lấy từ catalog JSON';
    }
  }

  filterButtons.forEach(button => button.addEventListener('click', () => {
    const category = button.dataset.category;
    if (!Object.hasOwn(categories, category)) return;
    activeCategory = category;
    filterButtons.forEach(item => item.setAttribute('aria-pressed',String(item===button)));
    render();
  }));
  searchInput.addEventListener('input',render);

  function showSubmitDialog() {
    if (submitDialog?.showModal) submitDialog.showModal();
    else window.alert('Trình duyệt hiện tại chưa hỗ trợ hộp thoại đề xuất.');
  }
  function closeSubmitDialog() {
    if (submitDialog?.open) submitDialog.close();
  }
  document.getElementById('openAssetSuggestion')?.addEventListener('click',showSubmitDialog);
  document.getElementById('closeAssetSuggestion')?.addEventListener('click',closeSubmitDialog);
  document.getElementById('cancelAssetSuggestion')?.addEventListener('click',closeSubmitDialog);

  submitForm?.addEventListener('submit',event=>{
    event.preventDefault();
    const values = Object.fromEntries(new FormData(submitForm).entries());
    const url = safePublicUrl(values.url);
    const thumbnailUrl = values.thumbnailUrl ? safePublicUrl(values.thumbnailUrl) : null;
    if (!url || (values.thumbnailUrl && !thumbnailUrl)) {
      window.alert('Hãy dùng đường dẫn HTTPS công khai trực tiếp đến tệp. Không dùng link trang chia sẻ có yêu cầu đăng nhập.');
      return;
    }
    const title = String(values.title || '').trim().slice(0,120);
    const body = [
      '## Đề xuất tài nguyên cộng đồng',
      '',
      '**Tên:** '+title,
      '**Danh mục:** '+String(values.category||''),
      '**Loại tệp:** '+String(values.mediaType||''),
      '**Đường dẫn tệp:** '+url,
      '**Ảnh xem trước:** '+(thumbnailUrl||'Không có'),
      '**Tác giả / nguồn:** '+String(values.author||'').slice(0,100),
      '**Giấy phép:** '+String(values.license||'').slice(0,100),
      '**Mô tả:** '+String(values.description||'').slice(0,600),
      '',
      'Người gửi xác nhận có quyền chia sẻ tài nguyên này.',
      '',
      'Lưu ý: Đây chỉ là đề xuất. Chủ kho sẽ kiểm tra liên kết, quyền sử dụng và khả năng tải trước khi đưa vào catalog. Tệp không được tải lên Geed Hardwin.'
    ].join('\\n');
    const issueUrl = new URL('https://github.com/hoangnguyen555grok-glitch/hardwin/issues/new');
    issueUrl.searchParams.set('title','Đề xuất vật liệu: '+title);
    issueUrl.searchParams.set('body',body);
    window.open(issueUrl.href,'_blank','noopener,noreferrer');
    closeSubmitDialog();
    submitForm.reset();
  });

  async function loadCatalog() {
    try {
      const response = await fetch('/assets/community-library.json',{cache:'no-cache',credentials:'same-origin'});
      if (!response.ok) throw new Error('HTTP '+response.status);
      const data = await response.json();
      if (!data || !Array.isArray(data.assets)) throw new Error('Invalid catalog');
      communityAssets = data.assets.map(normalizeAsset).filter(Boolean).slice(0,500);
      emptyFootnote.textContent = 'Cập nhật catalog: '+String(data.updatedAt||'chưa ghi ngày');
    } catch (error) {
      console.error('Community library catalog failed:',error);
      emptyTitle.textContent = 'Chưa tải được danh mục vật liệu';
      emptyDescription.textContent = 'Không tải được tệp catalog công khai. Hãy tải lại trang sau hoặc báo cho quản trị viên.';
      emptyFootnote.textContent = 'Danh mục: /assets/community-library.json';
      communityAssets = [];
    }
    render();
  }

  render();
  loadCatalog();
})();
