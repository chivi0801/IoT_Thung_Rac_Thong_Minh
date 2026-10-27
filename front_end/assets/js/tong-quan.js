/**
 * ==========================================================================
 * TỔNG QUAN JAVASCRIPT (tong-quan.js)
 * Xử lý dữ liệu KPI, tương tác Camera AI, Bảng hoạt động gần đây,
 * Xuất file CSV, Modal xem toàn bộ lịch sử và Đồng bộ giao diện Mobile.
 * ==========================================================================
 */

(function () {
  'use strict';

  // Dữ liệu 4 hoạt động gần nhất (khớp chính xác với giao diện ảnh mẫu)
  var recentActivities = [
    {
      time: '10:24:15',
      item: 'Chai nhựa',
      category: 'NHỰA',
      catKey: 'pl',
      confidence: '96.4%',
      confVal: 96.4,
      status: 'Thành công',
      modelClass: 'plastic_bottle',
      iconType: 'bottle'
    },
    {
      time: '10:18:02',
      item: 'Vỏ lon nhôm',
      category: 'KIM LOẠI',
      catKey: 'me',
      confidence: '94.2%',
      confVal: 94.2,
      status: 'Thành công',
      modelClass: 'can_metal',
      iconType: 'can'
    },
    {
      time: '10:05:40',
      item: 'Vỏ chuối',
      category: 'HỮU CƠ',
      catKey: 'or',
      confidence: '98.1%',
      confVal: 98.1,
      status: 'Thành công',
      modelClass: 'banana_peel',
      iconType: 'organic'
    },
    {
      time: '09:52:11',
      item: 'Hộp sữa giấy ép',
      category: 'NHỰA',
      catKey: 'pl',
      confidence: '91.5%',
      confVal: 91.5,
      status: 'Thành công',
      modelClass: 'milk_box',
      iconType: 'box'
    }
  ];

  // Danh sách mở rộng mô phỏng các hoạt động trước đó
  var extendedActivities = [
    { time: '09:35:04', item: 'Ly nhựa trà sữa', category: 'NHỰA', catKey: 'pl', confidence: '97.2%', status: 'Thành công', modelClass: 'plastic_cup', iconType: 'bottle' },
    { time: '09:20:18', item: 'Nắp lon nước ngọt', category: 'KIM LOẠI', catKey: 'me', confidence: '92.0%', status: 'Thành công', modelClass: 'metal_cap', iconType: 'can' },
    { time: '09:05:45', item: 'Cuống táo', category: 'HỮU CƠ', catKey: 'or', confidence: '95.6%', status: 'Thành công', modelClass: 'apple_core', iconType: 'organic' },
    { time: '08:50:12', item: 'Ống hút nhựa', category: 'NHỰA', catKey: 'pl', confidence: '89.4%', status: 'Thành công', modelClass: 'plastic_straw', iconType: 'bottle' },
    { time: '08:42:30', item: 'Lon cà phê sữa', category: 'KIM LOẠI', catKey: 'me', confidence: '95.1%', status: 'Thành công', modelClass: 'can_metal', iconType: 'can' },
    { time: '08:30:15', item: 'Lá rau thừa', category: 'HỮU CƠ', catKey: 'or', confidence: '94.8%', status: 'Thành công', modelClass: 'vegetable_scrap', iconType: 'organic' },
    { time: '08:15:22', item: 'Chai nước khoáng', category: 'NHỰA', catKey: 'pl', confidence: '98.3%', status: 'Thành công', modelClass: 'plastic_bottle', iconType: 'bottle' },
    { time: '08:02:40', item: 'Vỏ hộp thiếc', category: 'KIM LOẠI', catKey: 'me', confidence: '93.7%', status: 'Thành công', modelClass: 'tin_can', iconType: 'can' }
  ];

  var allActivities = recentActivities.concat(extendedActivities);

  // SVG Icons cho Camera preview
  var iconSvgs = {
    bottle: '<path d="M6 3h12l-1.5 16a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2L6 3Z"/><path d="M6 8h12"/><path d="M12 11c-1 1.5-2 2.5-2 3.5a2 2 0 0 0 4 0c0-1-1-2-2-3.5Z"/>',
    can: '<rect x="5" y="3" width="14" height="18" rx="4"/><path d="M5 8h14M5 16h14"/><ellipse cx="12" cy="5.5" rx="4" ry="1.5"/>',
    organic: '<path d="M11 20A7 7 0 0 1 4 13C4 9.13 7.13 6 11 6c.55 0 1 .45 1 1v13Z"/><path d="M13 20a7 7 0 0 0 7-7c0-3.87-3.13-7-7-7-.55 0-1 .45-1 1v13Z"/><path d="M12 6V2"/>',
    box: '<path d="M4 7V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7M2 7l10-4 10 4M12 3v18"/>'
  };

  var colorMap = {
    pl: { stroke: '#f59e0b', tagBg: '#f59e0b', badgeClass: 'pl', text: 'NHỰA' },
    me: { stroke: '#3b82f6', tagBg: '#2563eb', badgeClass: 'me', text: 'KIM LOẠI' },
    or: { stroke: '#10b981', tagBg: '#059669', badgeClass: 'or', text: 'HỮU CƠ' }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function notify(msg) {
    if (window.SmartBin && typeof window.SmartBin.toast === 'function') {
      window.SmartBin.toast(msg);
    }
  }

  /**
   * Hiển thị danh sách hoạt động gần nhất vào bảng Desktop
   */
  function renderRecentTable() {
    var tbody = $('activityTableBody');
    if (!tbody) return;

    var html = '';
    recentActivities.forEach(function (act, index) {
      html += '<tr data-index="' + index + '">' +
        '<td class="mono"><b>' + act.time + '</b></td>' +
        '<td>' + act.item + '</td>' +
        '<td><span class="badge-pill ' + act.catKey + '">' + act.category + '</span></td>' +
        '<td><span class="status-badge-ok">' + act.status + '</span></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
  }

  /**
   * Cập nhật giao diện Camera AI và bảng thông số khi chọn một vật thể
   */
  function displayDetection(act) {
    if (!act) return;
    var c = colorMap[act.catKey] || colorMap.pl;

    var labelClassEl = $('aiLabelClass');
    var labelConfEl = $('aiLabelConf');
    var labelEl = $('aiLabel');
    var boxEl = $('aiBox');
    var iconEl = $('aiIcon');
    var camConfText = $('camConfText');

    if (labelClassEl) labelClassEl.textContent = act.modelClass;
    if (labelConfEl) labelConfEl.textContent = act.confidence;
    if (labelEl) labelEl.style.background = c.tagBg;
    if (boxEl) boxEl.style.borderColor = c.stroke;

    if (iconEl) {
      iconEl.innerHTML = iconSvgs[act.iconType] || iconSvgs.bottle;
      iconEl.style.stroke = c.stroke;
    }

    if (camConfText) camConfText.textContent = 'ĐỘ TIN CẬY: ' + act.confidence;

    // Chi tiết dưới camera
    var detCat = $('detailCat');
    if (detCat) {
      detCat.className = 'badge-pill ' + act.catKey;
      detCat.textContent = act.category;
    }

    var detTime = $('detailTime');
    if (detTime) detTime.textContent = act.time;

    var detConf = $('detailConf');
    if (detConf) detConf.textContent = act.confidence;

    var detStatus = $('detailStatus');
    if (detStatus) detStatus.textContent = 'ĐÃ PHÂN LOẠI';
  }

  /**
   * Xuất log CSV hoạt động
   */
  function exportCsvLog() {
    var csvHeader = 'Thoi_gian,Vat_the,Phan_loai,Do_tin_cay,Trang_thai\n';
    var csvRows = allActivities.map(function (row) {
      return [
        '"' + row.time + '"',
        '"' + row.item + '"',
        '"' + row.category + '"',
        '"' + row.confidence + '"',
        '"' + row.status + '"'
      ].join(',');
    }).join('\n');

    var blob = new Blob(['\uFEFF' + csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'lich_su_phan_loai_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    notify('Đã xuất file log CSV thành công!');
  }

  /**
   * Hiển thị bảng trong Modal Xem tất cả
   */
  function renderModalRows(items) {
    var tbody = $('modalTableBody');
    if (!tbody) return;

    var html = '';
    items.forEach(function (act) {
      html += '<tr>' +
        '<td class="mono"><b>' + act.time + '</b></td>' +
        '<td>' + act.item + '</td>' +
        '<td><span class="badge-pill ' + act.catKey + '">' + act.category + '</span></td>' +
        '<td class="mono">' + act.confidence + '</td>' +
        '<td><span class="status-badge-ok">' + act.status + '</span></td>' +
        '</tr>';
    });
    tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;color:var(--mut);padding:24px;">Không tìm thấy kết quả phù hợp.</td></tr>';
  }

  function applyModalFilter() {
    var searchInput = $('searchInput');
    var filterCategory = $('filterCategory');
    if (!searchInput || !filterCategory) return;

    var q = searchInput.value.trim().toLowerCase();
    var cat = filterCategory.value;

    var filtered = allActivities.filter(function (x) {
      var matchText = x.item.toLowerCase().indexOf(q) !== -1 || x.time.indexOf(q) !== -1;
      var matchCat = cat === 'ALL' || x.category === cat;
      return matchText && matchCat;
    });
    renderModalRows(filtered);
  }

  // Khởi tạo các sự kiện khi DOM tải xong
  document.addEventListener('DOMContentLoaded', function () {
    renderRecentTable();
    displayDetection(recentActivities[0]);

    // Bấm vào dòng trong bảng để cập nhật khung camera
    var tbody = $('activityTableBody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-index]');
        if (!tr) return;
        var idx = parseInt(tr.dataset.index, 10);
        var act = recentActivities[idx];
        if (act) {
          displayDetection(act);
          notify('Đang hiển thị kết quả: ' + act.item);
        }
      });
    }

    // Nút xuất CSV
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
        renderModalRows(allActivities);
        modal.classList.add('open');
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

    // Tìm kiếm và lọc trong modal
    var searchInput = $('searchInput');
    var filterCategory = $('filterCategory');

    if (searchInput) searchInput.addEventListener('input', applyModalFilter);
    if (filterCategory) filterCategory.addEventListener('change', applyModalFilter);

    // =========================================================================
    // MOBILE INTERACTIONS (Khớp ảnh mẫu Tổng Quan)
    // =========================================================================
    var btnRefresh = $('btnRefreshSensors');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', function () {
        btnRefresh.classList.add('spinning');
        btnRefresh.disabled = true;

        setTimeout(function () {
          btnRefresh.classList.remove('spinning');
          btnRefresh.disabled = false;
          notify('Đã làm mới dữ liệu cảm biến thành công!');
        }, 700);
      });
    }

    // Click Avatar người dùng
    var avatarBtn = document.querySelector('.btn-user-avatar');
    if (avatarBtn) {
      avatarBtn.addEventListener('click', function () {
        notify('Tài khoản: Quản trị viên hệ thống (Admin)');
      });
    }
  });
})();
