/**
 * ==========================================================================
 * TỔNG QUAN JAVASCRIPT (tong-quan.js)
 * Nạp KPI, kết quả nhận diện mới nhất, hoạt động gần đây từ REST API,
 * xuất CSV và đồng bộ giao diện Desktop/Mobile theo dữ liệu thật.
 * ==========================================================================
 */

(function () {
  'use strict';

  var iconSvgs = {
    bottle: '<path d="M6 3h12l-1.5 16a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2L6 3Z"/><path d="M6 8h12"/><path d="M12 11c-1 1.5-2 2.5-2 3.5a2 2 0 0 0 4 0c0-1-1-2-2-3.5Z"/>',
    can: '<rect x="5" y="3" width="14" height="18" rx="4"/><path d="M5 8h14M5 16h14"/><ellipse cx="12" cy="5.5" rx="4" ry="1.5"/>',
    cup: '<path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>',
    organic: '<path d="M11 20A7 7 0 0 1 4 13C4 9.13 7.13 6 11 6c.55 0 1 .45 1 1v13Z"/><path d="M13 20a7 7 0 0 0 7-7c0-3.87-3.13-7-7-7-.55 0-1 .45-1 1v13Z"/><path d="M12 6V2"/>',
    box: '<path d="M4 7V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7M2 7l10-4 10 4M12 3v18"/>'
  };

  var colorMap = {
    pl: { stroke: '#f59e0b', tagBg: '#f59e0b', badgeClass: 'pl', text: 'NHỰA' },
    me: { stroke: '#3b82f6', tagBg: '#2563eb', badgeClass: 'me', text: 'KIM LOẠI' },
    or: { stroke: '#10b981', tagBg: '#059669', badgeClass: 'or', text: 'HỮU CƠ' }
  };

  var mobileActivityIcons = {
    pl: '<path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />',
    me: '<circle cx="12" cy="12" r="10" /><polygon points="12 6 16.5 9.5 15 15 9 15 7.5 9.5 12 6" />',
    or: '<path d="M11 20A7 7 0 0 1 4 13C4 9.13 7.13 6 11 6c.55 0 1 .45 1 1v13Z" /><path d="M13 20a7 7 0 0 0 7-7c0-3.87-3.13-7-7-7-.55 0-1 .45-1 1v13Z" /><path d="M12 6V2" />'
  };

  var cachedActivities = [];
  var modalActivities = [];
  var latestKpi = null;

  function $(id) {
    return document.getElementById(id);
  }

  function notify(msg) {
    if (window.SmartBin && typeof window.SmartBin.toast === 'function') {
      window.SmartBin.toast(msg);
    }
  }

  function categoryLabel(catKey) {
    if (catKey === 'me') return 'Rác Kim loại';
    if (catKey === 'or') return 'Rác Hữu cơ';
    return 'Rác Nhựa';
  }

  function categoryTitle(catKey) {
    if (catKey === 'me') return 'Kim loại';
    if (catKey === 'or') return 'Hữu cơ';
    return 'Nhựa';
  }

  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = value;
  }

  /* =========================================================================
     1. KPI METRICS
     ========================================================================= */
  function renderKpi(data) {
    if (!data) return;
    latestKpi = data;

    setText('totalCount', data.totalCount);
    setText('successRate', data.successRate);

    setText('nhuaCount', data.plasticCount);
    setText('nhuaPercent', 'VẬT THỂ (' + data.plasticPercent + '%)');

    setText('kimloaiCount', data.metalCount);
    setText('kimloaiPercent', 'VẬT THỂ (' + data.metalPercent + '%)');

    setText('huucoCount', data.organicCount);
    setText('huucoPercent', 'VẬT THỂ (' + data.organicPercent + '%)');

    setText('mTotalCount', data.totalCount);
    setText('mNhuaCount', data.plasticCount);
    setText('mNhuaPercent', data.plasticPercent + '%');
    setText('mKimloaiCount', data.metalCount);
    setText('mKimloaiPercent', data.metalPercent + '%');
    setText('mHuucoCount', data.organicCount);
    setText('mHuucoPercent', data.organicPercent + '%');

    updateActivityCounter();
  }

  /* =========================================================================
     2. LATEST DETECTION (CAMERA PREVIEW)
     ========================================================================= */
  function displayDetection(act) {
    if (!act) return;

    var catKey = act.catKey || 'pl';
    var c = colorMap[catKey] || colorMap.pl;
    var confidence = act.confidence || (act.confVal != null ? act.confVal + '%' : '--');
    var modelClass = act.modelClass || 'unknown';
    var time = act.time || '--';
    var status = act.status || 'ĐÃ PHÂN LOẠI';

    var labelClassEl = $('aiLabelClass');
    var labelConfEl = $('aiLabelConf');
    var labelEl = $('aiLabel');
    var boxEl = $('aiBox');
    var iconEl = $('aiIcon');
    var camConfText = $('camConfText');

    if (labelClassEl) labelClassEl.textContent = modelClass;
    if (labelConfEl) labelConfEl.textContent = confidence;
    if (labelEl) labelEl.style.background = c.tagBg;
    if (boxEl) boxEl.style.borderColor = c.stroke;

    if (iconEl) {
      iconEl.innerHTML = iconSvgs[act.iconType] || iconSvgs.bottle;
      iconEl.style.stroke = c.stroke;
    }

    if (camConfText) camConfText.textContent = 'ĐỘ TIN CẬY: ' + confidence;

    var detCat = $('detailCat');
    if (detCat) {
      detCat.className = 'badge-pill ' + catKey;
      detCat.textContent = act.category || c.text;
    }

    var detTime = $('detailTime');
    if (detTime) detTime.textContent = time;

    var detConf = $('detailConf');
    if (detConf) detConf.textContent = confidence;

    var detStatus = $('detailStatus');
    if (detStatus) detStatus.textContent = status;

    // ===== Mobile latest result card =====
    setText('mLatestTime', time);
    setText('mLatestItem', categoryLabel(catKey));
    var mCat = $('mLatestCat');
    if (mCat) {
      mCat.textContent = categoryTitle(catKey);
      mCat.className = 'col-' + catKey;
    }
  }

  /* =========================================================================
     3. RECENT ACTIVITIES
     ========================================================================= */
  function renderRecentTable(items) {
    var tbody = $('activityTableBody');
    cachedActivities = items || [];

    if (tbody) {
      var html = '';
      cachedActivities.forEach(function (act, index) {
        html += '<tr data-index="' + index + '">' +
          '<td class="mono"><b>' + (act.time || '--') + '</b></td>' +
          '<td><span class="badge-pill ' + (act.catKey || 'pl') + '">' + (act.category || '') + '</span></td>' +
          '<td><span class="status-badge-ok">' + (act.status || '') + '</span></td>' +
          '</tr>';
      });
      tbody.innerHTML = html || '<tr><td colspan="3" style="text-align:center;color:var(--mut);padding:20px;">Chưa có hoạt động nào.</td></tr>';
    }

    renderMobileActivities(cachedActivities);
    updateActivityCounter();
  }

  function renderMobileActivities(items) {
    var container = document.querySelector('.m-activities-list');
    if (!container) return;

    var html = '';
    (items || []).forEach(function (act) {
      var catKey = act.catKey || 'pl';
      var stroke = (colorMap[catKey] || colorMap.pl).stroke;
      var icon = mobileActivityIcons[catKey] || mobileActivityIcons.pl;

      html += '<div class="m-activity-row">' +
        '<div class="m-act-icon-circle bg-' + catKey + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            icon +
          '</svg>' +
        '</div>' +
        '<div class="m-act-info">' +
          '<div class="m-act-title">' + categoryLabel(catKey) + '</div>' +
          '<div class="m-act-sub">' +
            '<span class="col-' + catKey + '">' + categoryTitle(catKey) + '</span>' +
            '<span class="m-act-sep">•</span>' +
            '<span>Ngăn số ' + (catKey === 'me' ? 2 : (catKey === 'or' ? 3 : 1)) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="m-act-time">' + (act.time || '--') + '</div>' +
      '</div>';
    });

    container.innerHTML = html || '<div style="text-align:center;color:var(--mut);padding:18px;">Chưa có hoạt động nào.</div>';

    var pill = document.querySelector('.m-badge-count-pill');
    if (pill) pill.textContent = (items || []).length + ' mục mới';
  }

  function updateActivityCounter() {
    setText('displayedRows', cachedActivities.length);
    if (latestKpi) setText('totalRows', latestKpi.totalCount);
  }

  /* =========================================================================
     4. MODAL "XEM TẤT CẢ"
     ========================================================================= */
  function mapHistoryItem(item) {
    return {
      id: item.id,
      time: item.time,
      category: item.category,
      catKey: item.catKey,
      confidence: item.conf,
      status: item.status
    };
  }

  function loadAllActivities() {
    return window.SmartBin.request('/history?page=1&size=100&category=ALL')
      .then(function (page) {
        modalActivities = (page && page.items ? page.items : []).map(mapHistoryItem);
      });
  }

  function renderModalRows(items) {
    var tbody = $('modalTableBody');
    if (!tbody) return;

    var html = '';
    items.forEach(function (act) {
      html += '<tr>' +
        '<td class="mono"><b>' + (act.time || '--') + '</b></td>' +
        '<td><span class="badge-pill ' + (act.catKey || 'pl') + '">' + (act.category || '') + '</span></td>' +
        '<td class="mono">' + (act.confidence || '--') + '</td>' +
        '<td><span class="status-badge-ok">' + (act.status || '') + '</span></td>' +
        '</tr>';
    });
    tbody.innerHTML = html || '<tr><td colspan="4" style="text-align:center;color:var(--mut);padding:24px;">Không tìm thấy kết quả phù hợp.</td></tr>';
  }

  function applyModalFilter() {
    var searchInput = $('searchInput');
    var filterCategory = $('filterCategory');
    if (!searchInput || !filterCategory) return;

    var q = searchInput.value.trim().toLowerCase();
    var cat = filterCategory.value;

    var filtered = modalActivities.filter(function (x) {
      var matchText = (x.category || '').toLowerCase().indexOf(q) !== -1 || (x.time || '').indexOf(q) !== -1;
      var matchCat = cat === 'ALL' || x.category === cat;
      return matchText && matchCat;
    });
    renderModalRows(filtered);
  }

  /* =========================================================================
     5. CSV EXPORT
     ========================================================================= */
  function exportCsvLog() {
    fetch(window.API_BASE + '/dashboard/export-csv')
      .then(function (res) {
        if (!res.ok) throw new Error('Lỗi HTTP ' + res.status);
        return res.blob();
      })
      .then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'lich_su_phan_loai_' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notify('Đã xuất file log CSV thành công!');
      })
      .catch(function (err) {
        notify('Không thể xuất CSV: ' + err.message);
      });
  }

  /* =========================================================================
     6. DATA LOADING
     ========================================================================= */
  function loadDashboard() {
    return Promise.all([
      window.SmartBin.request('/dashboard/kpi'),
      window.SmartBin.request('/dashboard/latest'),
      window.SmartBin.request('/dashboard/recent-activities')
    ]).then(function (results) {
      renderKpi(results[0]);
      displayDetection(results[1]);
      renderRecentTable(results[2]);
    });
  }

  /* =========================================================================
     7. INITIALISATION
     ========================================================================= */
  document.addEventListener('DOMContentLoaded', function () {
    loadDashboard().catch(function (err) {
      notify('Không thể tải dữ liệu tổng quan: ' + err.message);
    });

    // Bấm vào dòng trong bảng để cập nhật khung camera
    var tbody = $('activityTableBody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-index]');
        if (!tr) return;
        var idx = parseInt(tr.dataset.index, 10);
        var act = cachedActivities[idx];
        if (act) {
          displayDetection(act);
          notify('Đang hiển thị kết quả phân loại: ' + act.category);
        }
      });
    }

    var btnExport = $('btnExportCsv');
    if (btnExport) {
      btnExport.addEventListener('click', exportCsvLog);
    }

    // Modal Xem tất cả
    var btnViewAll = $('btnViewAll');
    var modal = $('modalViewAll');
    var modalClose = $('modalClose');

    if (btnViewAll && modal) {
      btnViewAll.addEventListener('click', function () {
        modal.classList.add('open');
        loadAllActivities()
          .then(function () { renderModalRows(modalActivities); })
          .catch(function (err) { notify('Không thể tải lịch sử: ' + err.message); });
      });
    }

    if (modalClose && modal) {
      modalClose.addEventListener('click', function () {
        modal.classList.remove('open');
      });
    }

    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) {
          modal.classList.remove('open');
        }
      });
    }

    var searchInput = $('searchInput');
    var filterCategory = $('filterCategory');
    if (searchInput) searchInput.addEventListener('input', applyModalFilter);
    if (filterCategory) filterCategory.addEventListener('change', applyModalFilter);

    // Mobile interactions
    var btnRefresh = $('btnRefreshSensors');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', function () {
        btnRefresh.classList.add('spinning');
        btnRefresh.disabled = true;

        loadDashboard()
          .then(function () { notify('Đã làm mới dữ liệu cảm biến thành công!'); })
          .catch(function (err) { notify('Không thể làm mới dữ liệu: ' + err.message); })
          .finally(function () {
            btnRefresh.classList.remove('spinning');
            btnRefresh.disabled = false;
          });
      });
    }

    var avatarBtn = document.querySelector('.btn-user-avatar');
    if (avatarBtn) {
      avatarBtn.addEventListener('click', function () {
        notify('Tài khoản: Quản trị viên hệ thống (Admin)');
      });
    }

    // Cập nhật trực tiếp khi WebSocket báo có vật thể mới
    document.addEventListener('smartbin:new-detection', function () {
      loadDashboard().catch(function () {});
    });
  });

  window.SmartBinDashboard = {
    refresh: loadDashboard,
    applyDetection: function (act) {
      displayDetection(act);
      loadDashboard().catch(function () {});
    }
  };
})();
