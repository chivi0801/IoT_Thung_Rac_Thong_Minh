/**
 * ==========================================================================
 * LỊCH SỬ JAVASCRIPT (lich-su.js)
 * Quản lý bộ dữ liệu lịch sử phân loại, lọc theo danh mục,
 * phân trang Desktop và chế độ hiển thị Mobile Cards khớp 100% ảnh mẫu.
 * ==========================================================================
 */

(function () {
  'use strict';

  // 5 bản ghi đầu tiên khớp chính xác 100% với giao diện Mobile trong ảnh mẫu:
  // 1. Chai nhựa PET  [NHỰA]     10:24:15 • Cửa nạp #1  [✓ ĐÃ GẠT]
  // 2. Lon nước ngọt  [KIM LOẠI] 10:18:02 • Cửa nạp #1  [✓ ĐÃ GẠT]
  // 3. Vỏ chuối       [HỮU CƠ]   10:05:40 • Cửa nạp #2  [✓ ĐÃ GẠT]
  // 4. Cốc dùng 1 lần [NHỰA]     09:52:11 • Cửa nạp #1  [✓ ĐÃ GẠT]
  // 5. Hộp thiếc      [KIM LOẠI] 09:40:30 • Cửa nạp #1  [✓ ĐÃ GẠT]

  var baseRecords = [
    { time: '10:24:15', category: 'NHỰA', catKey: 'nhua', item: 'Chai nhựa PET', port: 'Cửa nạp #1', modelClass: 'plastic_bottle', conf: '96.4%', icon: 'bottle' },
    { time: '10:18:02', category: 'KIM LOẠI', catKey: 'kim-loai', item: 'Lon nước ngọt', port: 'Cửa nạp #1', modelClass: 'can_metal', conf: '94.2%', icon: 'can' },
    { time: '10:05:40', category: 'HỮU CƠ', catKey: 'huu-co', item: 'Vỏ chuối', port: 'Cửa nạp #2', modelClass: 'banana_peel', conf: '98.1%', icon: 'organic' },
    { time: '09:52:11', category: 'NHỰA', catKey: 'nhua', item: 'Cốc dùng 1 lần', port: 'Cửa nạp #1', modelClass: 'plastic_cup', conf: '91.5%', icon: 'cup' },
    { time: '09:40:30', category: 'KIM LOẠI', catKey: 'kim-loai', item: 'Hộp thiếc', port: 'Cửa nạp #1', modelClass: 'tin_box', conf: '95.8%', icon: 'box' },
    { time: '09:25:14', category: 'HỮU CƠ', catKey: 'huu-co', item: 'Cuống táo & vỏ trái cây', port: 'Cửa nạp #2', modelClass: 'apple_core', conf: '97.3%', icon: 'organic' }
  ];

  var extraNhua = [
    'Chai nước khoáng', 'Ống hút nhựa', 'Màng bọc thực phẩm', 'Khay nhựa định hình',
    'Thìa nhựa dùng 1 lần', 'Nắp cốc cà phê', 'Vỏ chai dầu gội', 'Chai tương ớt nhựa'
  ];
  var extraKimLoai = [
    'Lon bia 333', 'Vỏ hộp cá hộp', 'Đinh gỉ & ốc vít', 'Miếng thiếc vụn',
    'Nắp chai kim loại', 'Đế nến nhôm', 'Kẹp giấy kim loại', 'Nắp lon nước yến'
  ];
  var extraHuuCo = [
    'Lá xà lách dập', 'Bã trà túi lọc', 'Vỏ cam tươi', 'Cuống cà chua',
    'Vỏ trứng gà vụn', 'Bã cà phê rang', 'Mẩu bánh mì khô', 'Lõi ngô thừa'
  ];

  // Khởi tạo dataset 128 bản ghi (phù hợp với ghi chú "128 THAO TÁC CƠ KHÍ" trên mobile)
  var TOTAL_RECORDS = 128;
  var fullDataset = baseRecords.slice();
  var curHour = 9, curMin = 20;

  var idxN = 0, idxK = 0, idxH = 0;
  while (fullDataset.length < TOTAL_RECORDS) {
    curMin -= 3;
    if (curMin < 0) {
      curMin += 60;
      curHour -= 1;
      if (curHour < 0) curHour = 23;
    }
    var timeStr = ('0' + curHour).slice(-2) + ':' + ('0' + curMin).slice(-2) + ':' + ('0' + Math.floor(Math.random() * 59)).slice(-2);
    var rand = Math.random();

    if (rand < 0.45) {
      var itemN = extraNhua[idxN % extraNhua.length];
      idxN++;
      fullDataset.push({
        time: timeStr,
        category: 'NHỰA',
        catKey: 'nhua',
        item: itemN,
        port: 'Cửa nạp #1',
        modelClass: 'plastic_' + (idxN % 6),
        conf: (90 + Math.random() * 8).toFixed(1) + '%',
        icon: idxN % 2 === 0 ? 'bottle' : 'cup'
      });
    } else if (rand < 0.72) {
      var itemK = extraKimLoai[idxK % extraKimLoai.length];
      idxK++;
      fullDataset.push({
        time: timeStr,
        category: 'KIM LOẠI',
        catKey: 'kim-loai',
        item: itemK,
        port: 'Cửa nạp #1',
        modelClass: 'metal_' + (idxK % 5),
        conf: (91 + Math.random() * 7).toFixed(1) + '%',
        icon: idxK % 2 === 0 ? 'can' : 'box'
      });
    } else {
      var itemH = extraHuuCo[idxH % extraHuuCo.length];
      idxH++;
      fullDataset.push({
        time: timeStr,
        category: 'HỮU CƠ',
        catKey: 'huu-co',
        item: itemH,
        port: 'Cửa nạp #2',
        modelClass: 'organic_' + (idxH % 5),
        conf: (92 + Math.random() * 7).toFixed(1) + '%',
        icon: 'organic'
      });
    }
  }

  // Biểu tượng SVG cho từng loại vật thể (khớp chính xác hình dạng trên ảnh mẫu)
  var svgIcons = {
    bottle: '<path d="M8 2h8v3H8zM6 5h12v2H6zM5 7h14v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V7z"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>',
    cup: '<path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>',
    can: '<rect x="6" y="4" width="12" height="17" rx="3"/><ellipse cx="12" cy="4" rx="6" ry="2"/><path d="M6 9h12M6 16h12"/>',
    box: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M2 5h20M7 11h10M7 15h10"/>',
    organic: '<circle cx="12" cy="14" r="6.5"/><path d="M12 7.5V4"/><circle cx="12" cy="4" r="1.5"/>'
  };

  var colorSettings = {
    'nhua': { stroke: '#f59e0b', tagBg: '#f59e0b' },
    'kim-loai': { stroke: '#3b82f6', tagBg: '#2563eb' },
    'huu-co': { stroke: '#10b981', tagBg: '#059669' }
  };

  // State
  var currentFilter = 'ALL';
  var desktopPage = 1;
  var desktopPageSize = 6;
  var mobileLimit = 5; // Mặc định hiển thị đúng 5 thẻ trên mobile theo ảnh mẫu
  var filteredList = fullDataset;

  function $(id) {
    return document.getElementById(id);
  }

  function updateFilteredData() {
    if (currentFilter === 'ALL') {
      filteredList = fullDataset;
    } else {
      filteredList = fullDataset.filter(function (x) {
        return x.category === currentFilter;
      });
    }
    desktopPage = 1;
    mobileLimit = 5;
    render();
  }

  /* =========================================================================
     1. DESKTOP RENDER: BẢNG 5 CỘT & PHÂN TRANG
     ========================================================================= */
  function renderDesktopTable() {
    var tbody = $('historyTableBody');
    if (!tbody) return;

    var startIdx = (desktopPage - 1) * desktopPageSize;
    var endIdx = Math.min(startIdx + desktopPageSize, filteredList.length);
    var pageItems = filteredList.slice(startIdx, endIdx);

    var html = '';
    pageItems.forEach(function (row, idx) {
      var realIndex = startIdx + idx;
      html += '<tr>' +
        '<td><div class="time-cell"><span class="time-dot"></span>' + row.time + '</div></td>' +
        '<td><span class="cat-tag ' + row.catKey + '">[' + row.category + ']</span></td>' +
        '<td>' +
          '<button class="btn-thumb" data-index="' + realIndex + '" title="Xem ảnh AI nhận diện">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
              '<circle cx="8.5" cy="8.5" r="1.5"/>' +
              '<polyline points="21 15 16 10 5 21"/>' +
            '</svg>' +
          '</button>' +
        '</td>' +
        '<td>' +
          '<span class="pill-status">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>' +
            'ĐÃ PHÂN LOẠI' +
          '</span>' +
        '</td>' +
        '<td>' +
          '<span class="pill-conf">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>' +
            'CAO' +
          '</span>' +
        '</td>' +
      '</tr>';
    });

    if (pageItems.length === 0) {
      html = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--mut);">Không có bản ghi nào.</td></tr>';
    }

    tbody.innerHTML = html;

    var total = filteredList.length;
    var displayStart = total > 0 ? (startIdx + 1) : 0;
    var displayEnd = endIdx;

    var startEl = $('pageStart');
    var endEl = $('pageEnd');
    var totalEl = $('pageTotal');

    if (startEl) startEl.textContent = displayStart;
    if (endEl) endEl.textContent = displayEnd;
    if (totalEl) totalEl.textContent = total;
  }

  function renderDesktopPagination() {
    var container = $('paginationControls');
    if (!container) return;

    var totalPages = Math.ceil(filteredList.length / desktopPageSize) || 1;
    var html = '';

    html += '<button class="page-btn" id="btnPrev" ' + (desktopPage <= 1 ? 'disabled' : '') + '>&lt; Trang trước</button>';

    for (var p = 1; p <= totalPages; p++) {
      if (totalPages <= 7 || p === 1 || p === totalPages || (p >= desktopPage - 1 && p <= desktopPage + 1)) {
        html += '<button class="page-btn ' + (p === desktopPage ? 'active' : '') + '" data-page="' + p + '">' + p + '</button>';
      } else if (p === desktopPage - 2 || p === desktopPage + 2) {
        html += '<span style="color:var(--mut);padding:0 4px;">...</span>';
      }
    }

    html += '<button class="page-btn" id="btnNext" ' + (desktopPage >= totalPages ? 'disabled' : '') + '>Trang sau &gt;</button>';
    container.innerHTML = html;
  }

  /* =========================================================================
     2. MOBILE RENDER: THẺ CARD KHỚP 100% ẢNH MẪU SMARTPHONE
     ========================================================================= */
  function renderMobileCards() {
    var container = $('mobileCardsList');
    if (!container) return;

    var shownItems = filteredList.slice(0, mobileLimit);
    var html = '';

    shownItems.forEach(function (row, idx) {
      var iconMarkup = svgIcons[row.icon] || svgIcons.bottle;

      html += '<div class="mobile-history-card" data-index="' + idx + '">' +
        '<div class="card-left">' +
          '<div class="card-thumb ' + row.catKey + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              iconMarkup +
            '</svg>' +
          '</div>' +
          '<div class="card-info">' +
            '<div class="card-name-row">' +
              '<span class="card-item-name">' + row.item + '</span>' +
              '<span class="cat-tag ' + row.catKey + '">' + row.category + '</span>' +
            '</div>' +
            '<div class="card-meta">' +
              '<span>' + row.time + '</span> • <span>' + row.port + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="card-right">' +
          '<span class="status-actuated-pill">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M18 6L7 17l-5-5"/>' +
              '<path d="M22 10l-7.5 7.5-2-2"/>' +
            '</svg>' +
            '<span>[✓ ĐÃ GẠT]</span>' +
          '</span>' +
          '<svg class="chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' +
        '</div>' +
      '</div>';
    });

    if (shownItems.length === 0) {
      html = '<div style="text-align:center;padding:28px;color:var(--mut);background:#fff;border-radius:16px;">Không tìm thấy bản ghi phù hợp.</div>';
    }

    container.innerHTML = html;

    // Cập nhật text số lượng trên mobile
    var curShown = shownItems.length;
    var totalCount = filteredList.length;

    var subheadText = $('subheadCountText');
    if (subheadText) subheadText.textContent = curShown + ' / ' + totalCount + ' MỤC';

    var shownCountEl = $('mobileShownCount');
    if (shownCountEl) shownCountEl.textContent = curShown;

    var totalCountEl = $('mobileTotalCount');
    if (totalCountEl) totalCountEl.textContent = totalCount;

    // Ẩn nút "Tải thêm" nếu đã hiển thị hết
    var btnLoad = $('btnLoadMore');
    if (btnLoad) {
      btnLoad.style.display = curShown >= totalCount ? 'none' : 'flex';
    }
  }

  function render() {
    renderDesktopTable();
    renderDesktopPagination();
    renderMobileCards();
  }

  /* =========================================================================
     3. MODAL XEM ẢNH CAMERA AI
     ========================================================================= */
  function openImageModal(item) {
    var col = colorSettings[item.catKey] || colorSettings.nhua;

    var modalAiClass = $('modalAiClass');
    var modalAiConf = $('modalAiConf');
    var modalAiTag = $('modalAiTag');
    var modalAiBox = $('modalAiBox');
    var modalAiIcon = $('modalAiIcon');

    if (modalAiClass) modalAiClass.textContent = item.modelClass;
    if (modalAiConf) modalAiConf.textContent = item.conf;
    if (modalAiTag) modalAiTag.style.background = col.tagBg;
    if (modalAiBox) modalAiBox.style.borderColor = col.stroke;
    if (modalAiIcon) modalAiIcon.style.stroke = col.stroke;

    var modalItemName = $('modalItemName');
    if (modalItemName) modalItemName.textContent = item.item;

    var modalCategory = $('modalCategory');
    if (modalCategory) modalCategory.textContent = item.category + ' (' + item.port + ')';

    var modalTimestamp = $('modalTimestamp');
    if (modalTimestamp) modalTimestamp.textContent = item.time;

    var modalConfidence = $('modalConfidence');
    if (modalConfidence) modalConfidence.textContent = item.conf + ' (CAO)';

    var imageModal = $('imageModal');
    if (imageModal) imageModal.classList.add('open');
  }

  // Khởi tạo các sự kiện khi DOM tải xong
  document.addEventListener('DOMContentLoaded', function () {
    // Lọc trên Desktop Tabs
    var desktopFilter = document.querySelector('.filter-card');
    if (desktopFilter) {
      desktopFilter.addEventListener('click', function (e) {
        var btn = e.target.closest('.filter-btn');
        if (!btn) return;

        document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
        var filterVal = btn.dataset.filter;
        document.querySelectorAll('.filter-btn[data-filter="' + filterVal + '"]').forEach(function (b) {
          b.classList.add('active');
        });

        currentFilter = filterVal;
        updateFilteredData();
      });
    }

    // Lọc trên Mobile Tabs
    var mobileFilter = document.querySelector('.mobile-filter-tabs');
    if (mobileFilter) {
      mobileFilter.addEventListener('click', function (e) {
        var btn = e.target.closest('.filter-btn');
        if (!btn) return;

        document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
        var filterVal = btn.dataset.filter;
        document.querySelectorAll('.filter-btn[data-filter="' + filterVal + '"]').forEach(function (b) {
          b.classList.add('active');
        });

        currentFilter = filterVal;
        updateFilteredData();
      });
    }

    // Phân trang Desktop
    var paginationControls = $('paginationControls');
    if (paginationControls) {
      paginationControls.addEventListener('click', function (e) {
        var btn = e.target.closest('.page-btn');
        if (!btn || btn.disabled) return;

        if (btn.id === 'btnPrev') {
          if (desktopPage > 1) {
            desktopPage--;
            render();
          }
        } else if (btn.id === 'btnNext') {
          var totalPages = Math.ceil(filteredList.length / desktopPageSize);
          if (desktopPage < totalPages) {
            desktopPage++;
            render();
          }
        } else if (btn.dataset.page) {
          desktopPage = parseInt(btn.dataset.page, 10);
          render();
        }
      });
    }

    // Click nút thumbnail trên bảng Desktop
    var tbody = $('historyTableBody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        var thumb = e.target.closest('.btn-thumb');
        if (!thumb) return;
        var idx = parseInt(thumb.dataset.index, 10);
        var item = filteredList[idx];
        if (item) openImageModal(item);
      });
    }

    // Click vào Card trên Mobile
    var mobileCardsList = $('mobileCardsList');
    if (mobileCardsList) {
      mobileCardsList.addEventListener('click', function (e) {
        var card = e.target.closest('.mobile-history-card');
        if (!card) return;
        var idx = parseInt(card.dataset.index, 10);
        var item = filteredList[idx];
        if (item) openImageModal(item);
      });
    }

    // Nút [Tải thêm bản ghi] trên Mobile
    var btnLoadMore = $('btnLoadMore');
    if (btnLoadMore) {
      btnLoadMore.addEventListener('click', function () {
        mobileLimit += 5;
        renderMobileCards();
      });
    }

    // Đóng Modal
    var modalClose = $('modalClose');
    var imageModal = $('imageModal');

    if (modalClose && imageModal) {
      modalClose.addEventListener('click', function () {
        imageModal.classList.remove('open');
      });
    }

    if (imageModal) {
      imageModal.addEventListener('click', function (e) {
        if (e.target === imageModal) {
          imageModal.classList.remove('open');
        }
      });
    }

    // Khởi động render ban đầu
    updateFilteredData();
  });
})();
