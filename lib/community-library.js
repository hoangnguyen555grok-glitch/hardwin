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

  // The public collection intentionally starts empty. Real assets will be added
  // only after the upload, optimization, moderation and storage pipeline exists.
  const communityAssets = Object.freeze([]);
  const searchInput = document.getElementById('librarySearch');
  const filterButtons = [...document.querySelectorAll('[data-category]')];
  const resultsTitle = document.getElementById('resultsTitle');
  const resultsCount = document.getElementById('resultsCount');
  const assetTotal = document.getElementById('assetTotal');
  const emptyTitle = document.getElementById('emptyTitle');
  const emptyDescription = document.getElementById('emptyDescription');
  const emptyFootnote = document.getElementById('emptyFootnote');

  if (!searchInput || !resultsTitle || !resultsCount || !assetTotal) return;

  let activeCategory = 'all';

  function render() {
    const query = searchInput.value.trim().toLocaleLowerCase('vi');
    const matchedAssets = communityAssets.filter((asset) => {
      const categoryMatches = activeCategory === 'all' || asset.category === activeCategory;
      const searchableText = [asset.title, asset.description, asset.author, ...(asset.tags || [])]
        .filter(Boolean).join(' ').toLocaleLowerCase('vi');
      return categoryMatches && (!query || searchableText.includes(query));
    });

    const categoryName = categories[activeCategory] || categories.all;
    resultsTitle.textContent = categoryName;
    resultsCount.textContent = query
      ? '0 kết quả phù hợp'
      : `${matchedAssets.length} tài nguyên`;
    assetTotal.textContent = String(communityAssets.length);

    if (query) {
      emptyTitle.textContent = 'Chưa có kết quả để hiển thị';
      emptyDescription.textContent = 'Kho hiện chưa có tài nguyên đã xuất bản. Từ khóa của bạn sẽ tìm được kết quả khi các vật liệu đầu tiên được bổ sung.';
      emptyFootnote.textContent = `Từ khóa: “${searchInput.value.trim()}”`;
    } else if (activeCategory !== 'all') {
      emptyTitle.textContent = `Danh mục ${categoryName.toLocaleLowerCase('vi')} đang chờ nội dung`;
      emptyDescription.textContent = 'Danh mục đã được tạo sẵn. Tài nguyên sẽ xuất hiện tại đây sau khi được đóng góp và duyệt.';
      emptyFootnote.textContent = 'Chưa có tài nguyên trong danh mục này';
    } else {
      emptyTitle.textContent = 'Kho cộng đồng đang được chuẩn bị';
      emptyDescription.textContent = 'Chưa có tài nguyên nào được xuất bản. Chúng ta đang xây dựng nền tảng để hình ảnh và vật liệu được hiển thị gọn nhẹ, dễ tìm và có thông tin nguồn rõ ràng.';
      emptyFootnote.textContent = 'Danh mục đã sẵn sàng · Nội dung sẽ được bổ sung sau';
    }

    filterButtons.forEach((button) => {
      const selected = button.dataset.category === activeCategory;
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const category = button.dataset.category;
      if (!Object.hasOwn(categories, category)) return;
      activeCategory = category;
      render();
    });
  });

  searchInput.addEventListener('input', render);
  render();
})();
