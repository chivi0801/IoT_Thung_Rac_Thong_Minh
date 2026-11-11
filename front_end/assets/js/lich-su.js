/**
 * ==========================================================================
 * LỊCH SỬ JAVASCRIPT (lich-su.js)
 * Nạp lịch sử phân loại từ REST API, lọc theo danh mục, phân trang Desktop
 * và tải thêm dần trên Mobile; xem ảnh snapshot AI qua modal.
 * ==========================================================================
 */

(function () {
  'use strict';

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

  var currentFilter = 'ALL';
  var desktopPage = 1;
  var desktopPageSize = 6;
  var mobileLimit = 5;
  var desktopItems = [];

  function $(id) {
    return document.getElementById(id);
  }

  function notify(msg) {
    if (window.SmartBin && typeof window.SmartBin.toast === 'function') {
      window.SmartBin.toast(msg);
    }
  }

  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = value;
  }

  function confidenceLevel(row) {
    var val = row.confVal != null ? row.confVal : 0;
    if (val >= 90) return 'CAO';
    if (val >= 70) return 'TRUNG BÌNH';
    return 'THẤP';
  }

  function categoryShortLabel(filter) {
    if (filter === 'NHỰA') return 'Nhựa';
    if (filter === 'KIM LOẠI') return 'Kim loại';
    if (filter === 'HỮU CƠ' || filter === 'GIẤY') return 'Giấy';
    return 'Tất cả';
  }

  /* =========================================================================
     1. DESKTOP TABLE & PAGINATION
     ========================================================================= */
  function renderDesktopTable(pageData) {
    var tbody = $('historyTableBody');
    if (!tbody) return;

    desktopItems = pageData.items || [];

    var html = '';
    desktopItems.forEach(function (row) {
      html += '<tr>' +
        '<td><div class="time-cell"><span class="time-dot"></span>' + (row.time || '--') + '</div></td>' +
        '<td><span class="cat-tag ' + row.catKey + '">[' + row.category + ']</span></td>' +
        '<td>' +
          '<button class="btn-thumb" data-id="' + row.id + '" title="Xem ảnh AI nhận diện">' +
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
            (row.status || 'ĐÃ PHÂN LOẠI') +
          '</span>' +
        '</td>' +
        '<td>' +
          '<span class="pill-conf" title="' + (row.conf || '') + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>' +
            confidenceLevel(row) +
          '</span>' +
        '</td>' +
      '</tr>';
    });

    if (desktopItems.length === 0) {
      html = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--mut);">Không có bản ghi nào.</td></tr>';
    }

    tbody.innerHTML = html;

    var total = pageData.totalElements || 0;
    var page = pageData.currentPage || 1;
    var size = pageData.pageSize || desktopPageSize;
    var displayStart = total > 0 ? (page - 1) * size + 1 : 0;
    var displayEnd = (page - 1) * size + desktopItems.length;

    setText('pageStart', displayStart);
    setText('pageEnd', displayEnd);
    setText('pageTotal', total);
  }

  function renderDesktopPagination(pageData) {
    var container = $('paginationControls');
    if (!container) return;

    var totalPages = pageData.totalPages || 1;
    var page = pageData.currentPage || 1;
    var html = '';

    html += '<button class="page-btn" id="btnPrev" ' + (page <= 1 ? 'disabled' : '') + '>&lt; Trang trước</button>';

    for (var p = 1; p <= totalPages; p++) {
      if (totalPages <= 7 || p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
        html += '<button class="page-btn ' + (p === page ? 'active' : '') + '" data-page="' + p + '">' + p + '</button>';
      } else if (p === page - 2 || p === page + 2) {
        html += '<span style="color:var(--mut);padding:0 4px;">...</span>';
      }
    }

    html += '<button class="page-btn" id="btnNext" ' + (page >= totalPages ? 'disabled' : '') + '>Trang sau &gt;</button>';
    container.innerHTML = html;
  }

  /* =========================================================================
     2. MOBILE CARDS
     ========================================================================= */
  function renderMobileCards(pageData) {
    var container = $('mobileCardsList');
    if (!container) return;

    var items = pageData.items || [];
    var html = '';

    items.forEach(function (row) {
      var iconMarkup = svgIcons[row.icon] || svgIcons.bottle;

      html += '<div class="mobile-history-card" data-id="' + row.id + '">' +
        '<div class="card-left">' +
          '<div class="card-thumb ' + row.catKey + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              iconMarkup +
            '</svg>' +
          '</div>' +
          '<div class="card-info">' +
            '<div class="card-name-row">' +
              '<span class="card-item-name">' + (row.category === 'NHỰA' ? 'Rác Nhựa' : (row.category === 'KIM LOẠI' ? 'Rác Kim loại' : 'Rác Giấy')) + '</span>' +
              '<span class="cat-tag ' + row.catKey + '">' + row.category + '</span>' +
            '</div>' +
            '<div class="card-meta">' +
              '<span>' + (row.time || '--') + '</span> • <span>' + (row.port || '') + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="card-right">' +
          '<span class="status-actuated-pill">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M18 6L7 17l-5-5"/>' +
              '<path d="M22 10l-7.5 7.5-2-2"/>' +
            '</svg>' +
            '<span>[' + (row.status || 'ĐÃ PHÂN LOẠI') + ']</span>' +
          '</span>' +
          '<svg class="chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' +
        '</div>' +
      '</div>';
    });

    if (items.length === 0) {
      html = '<div style="text-align:center;padding:28px;color:var(--mut);background:#fff;border-radius:16px;">Không tìm thấy bản ghi phù hợp.</div>';
    }

    container.innerHTML = html;

    var shown = items.length;
    var total = pageData.totalElements || 0;

    setText('subheadCountText', shown + ' / ' + total + ' MỤC');
    setText('mobileShownCount', shown);
    setText('mobileTotalCount', total);

    var btnLoad = $('btnLoadMore');
    if (btnLoad) {
      btnLoad.style.display = shown >= total ? 'none' : 'flex';
    }
  }

  /* =========================================================================
     3. CATEGORY COUNTERS
     ========================================================================= */
  function updateCategoryCounts(counts) {
    if (!counts) return;

    setText('totalBadgeCount', counts['ALL'] != null ? counts['ALL'] : 0);

    document.querySelectorAll('.filter-btn').forEach(function (btn) {
      var filter = btn.dataset.filter;
      var count = counts[filter];
      if (count == null && filter === 'GIẤY') {
        count = counts['HỮU CƠ'];
      }
      count = count != null ? count : 0;
      var label = categoryShortLabel(filter);

      var span = btn.querySelector('span');
      if (span) {
        span.textContent = label + ' (' + count + ')';
      } else {
        btn.textContent = label + ' (' + count + ')';
      }
    });
  }

  /* =========================================================================
     4. DATA LOADING
     ========================================================================= */
  function historyUrl(page, size) {
    return '/history?page=' + page + '&size=' + size + '&category=' + encodeURIComponent(currentFilter);
  }

  function loadDesktop() {
    return window.SmartBin.request(historyUrl(desktopPage, desktopPageSize))
      .then(function (pageData) {
        renderDesktopTable(pageData);
        renderDesktopPagination(pageData);
        updateCategoryCounts(pageData.categoryCounts);
      });
  }

  function loadMobile() {
    return window.SmartBin.request(historyUrl(1, mobileLimit))
      .then(function (pageData) {
        renderMobileCards(pageData);
      });
  }

  function loadAll() {
    return Promise.all([loadDesktop(), loadMobile()]);
  }

  /* =========================================================================
     5. SNAPSHOT MODAL
     ========================================================================= */
  function openSnapshot(id) {
    window.SmartBin.request('/history/' + id + '/snapshot')
      .then(function (data) {
        if (!data) return;

        var col = colorSettings[data.catKey] || colorSettings.nhua;

        setText('modalAiClass', data.modelClass || 'unknown');
        setText('modalAiConf', data.conf || '--');
        setText('modalCategory', data.category || '--');
        setText('modalTimestamp', data.time || '--');
        setText('modalConfidence', data.confidenceLevel || data.conf || '--');

        var modalAiTag = $('modalAiTag');
        var modalAiBox = $('modalAiBox');
        var modalAiIcon = $('modalAiIcon');

        if (modalAiTag) modalAiTag.style.background = col.tagBg;
        if (modalAiBox) modalAiBox.style.borderColor = col.stroke;
        if (modalAiIcon) modalAiIcon.style.stroke = col.stroke;

        var imageModal = $('imageModal');
        if (imageModal) imageModal.classList.add('open');
      })
      .catch(function (err) {
        notify('Không thể tải ảnh nhận diện: ' + err.message);
      });
  }

  /* =========================================================================
     6. INITIALISATION
     ========================================================================= */
  function applyFilter(filter) {
    currentFilter = filter;
    desktopPage = 1;
    mobileLimit = 5;

    document.querySelectorAll('.filter-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.filter === filter);
    });

    loadAll().catch(function (err) {
      notify('Không thể tải lịch sử: ' + err.message);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var desktopFilter = document.querySelector('.filter-card');
    if (desktopFilter) {
      desktopFilter.addEventListener('click', function (e) {
        var btn = e.target.closest('.filter-btn');
        if (btn) applyFilter(btn.dataset.filter);
      });
    }

    var mobileFilter = document.querySelector('.mobile-filter-tabs');
    if (mobileFilter) {
      mobileFilter.addEventListener('click', function (e) {
        var btn = e.target.closest('.filter-btn');
        if (btn) applyFilter(btn.dataset.filter);
      });
    }

    var paginationControls = $('paginationControls');
    if (paginationControls) {
      paginationControls.addEventListener('click', function (e) {
        var btn = e.target.closest('.page-btn');
        if (!btn || btn.disabled) return;

        if (btn.id === 'btnPrev') {
          if (desktopPage > 1) {
            desktopPage--;
            loadDesktop().catch(function (err) { notify(err.message); });
          }
        } else if (btn.id === 'btnNext') {
          desktopPage++;
          loadDesktop().catch(function (err) { notify(err.message); });
        } else if (btn.dataset.page) {
          desktopPage = parseInt(btn.dataset.page, 10);
          loadDesktop().catch(function (err) { notify(err.message); });
        }
      });
    }

    var tbody = $('historyTableBody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        var thumb = e.target.closest('.btn-thumb');
        if (!thumb) return;
        openSnapshot(thumb.dataset.id);
      });
    }

    var mobileCardsList = $('mobileCardsList');
    if (mobileCardsList) {
      mobileCardsList.addEventListener('click', function (e) {
        var card = e.target.closest('.mobile-history-card');
        if (!card) return;
        openSnapshot(card.dataset.id);
      });
    }

    var btnLoadMore = $('btnLoadMore');
    if (btnLoadMore) {
      btnLoadMore.addEventListener('click', function () {
        mobileLimit += 5;
        loadMobile().catch(function (err) { notify(err.message); });
      });
    }

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

    loadAll().catch(function (err) {
      notify('Không thể tải lịch sử: ' + err.message);
    });
  });
})();
