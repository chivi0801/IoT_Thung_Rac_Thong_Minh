/**
 * ==========================================================================
 * TỔNG QUAN JAVASCRIPT (tong-quan.js)
 * Xử lý dữ liệu KPI, tương tác Camera AI, Bảng hoạt động gần đây,
 * Xuất file CSV, Modal xem toàn bộ lịch sử và Đồng bộ giao diện Mobile.
 * ==========================================================================
 */

(function () {
  'use strict';

  // Kết quả thật được nạp từ backend khi ESP32 gửi xong một batch ảnh.
  var recentActivities = [];
  var extendedActivities = [];

  var allActivities = recentActivities.concat(extendedActivities);
  var lastBatchId = null;
  var latestPollInProgress = false;

  // SVG Icons cho Camera preview
  var iconSvgs = {
    bottle: '<path d="M6 3h12l-1.5 16a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2L6 3Z"/><path d="M6 8h12"/><path d="M12 11c-1 1.5-2 2.5-2 3.5a2 2 0 0 0 4 0c0-1-1-2-2-3.5Z"/>',
    can: '<rect x="5" y="3" width="14" height="18" rx="4"/><path d="M5 8h14M5 16h14"/><ellipse cx="12" cy="5.5" rx="4" ry="1.5"/>',
    organic: '<path d="M11 20A7 7 0 0 1 4 13C4 9.13 7.13 6 11 6c.55 0 1 .45 1 1v13Z"/><path d="M13 20a7 7 0 0 0 7-7c0-3.87-3.13-7-7-7-.55 0-1 .45-1 1v13Z"/><path d="M12 6V2"/>',
    box: '<path d="M4 7V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7M2 7l10-4 10 4M12 3v18"/>'
  };

  var colorMap = {
    pl: { stroke: '#f59e0b', tagBg: '#f59e0b', badgeClass: 'pl', text: 'CHAI NHỰA' },
    me: { stroke: '#3b82f6', tagBg: '#2563eb', badgeClass: 'me', text: 'LON NƯỚC' },
    or: { stroke: '#10b981', tagBg: '#059669', badgeClass: 'or', text: 'LY GIẤY' }
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

    var displayed = $('displayedRows');
    var total = $('totalRows');
    if (displayed) displayed.textContent = String(recentActivities.length);
    if (total) total.textContent = String(recentActivities.length);

    if (recentActivities.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px">Đang chờ ESP32 gửi ảnh...</td></tr>';
      return;
    }

    var html = '';
    recentActivities.forEach(function (act, index) {
      html += '<tr data-index="' + index + '">' +
        '<td class="mono"><b>' + act.time + '</b></td>' +
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

    if (labelClassEl) labelClassEl.textContent = act.modelClass || 'Chưa phân loại';
    if (labelConfEl) labelConfEl.textContent = act.confidence || '--';
    if (labelEl) labelEl.style.background = c.tagBg;
    if (boxEl) boxEl.style.borderColor = c.stroke;

    if (iconEl) {
      iconEl.innerHTML = iconSvgs[act.iconType] || iconSvgs.bottle;
      iconEl.style.stroke = c.stroke;
    }

    if (camConfText) camConfText.textContent = 'ĐỘ TIN CẬY: ' + (act.confidence || '--');

    // Chi tiết dưới camera
    var detCat = $('detailCat');
    if (detCat) {
      detCat.className = 'badge-pill ' + act.catKey;
      detCat.textContent = act.category || 'CHƯA PHÂN LOẠI';
    }

    var detTime = $('detailTime');
    if (detTime) detTime.textContent = act.time;

    var detConf = $('detailConf');
    if (detConf) detConf.textContent = act.confidence || '--';

    var detStatus = $('detailStatus');
    if (detStatus) detStatus.textContent = act.status || 'ĐÃ PHÂN LOẠI';
  }

  function showWaitingForEsp32(message) {
    var viewport = $('cameraViewport');
    var image = $('processedImage');
    if (viewport) viewport.classList.remove('has-image');
    if (image) {
      image.hidden = true;
      image.removeAttribute('src');
    }
    var indicator = $('camLiveIndicator');
    if (indicator) indicator.textContent = 'ESP32 · CHỜ DỮ LIỆU';
    var label = $('aiLabelClass');
    if (label) label.textContent = message || 'Đang chờ ảnh từ ESP32';
    var confidence = $('aiLabelConf');
    if (confidence) confidence.textContent = '--';
    var detailStatus = $('detailStatus');
    if (detailStatus) detailStatus.textContent = 'ĐANG CHỜ';
    var camConfidence = $('camConfText');
    if (camConfidence) camConfidence.textContent = message || 'CHƯA NHẬN ẢNH';
    var detailCategory = $('detailCat');
    if (detailCategory) detailCategory.textContent = 'ĐANG CHỜ';
    var detailTime = $('detailTime');
    if (detailTime) detailTime.textContent = '--';
    var detailConfidence = $('detailConf');
    if (detailConfidence) detailConfidence.textContent = '--';
  }

  function displayLatestBatch(batch) {
    if (batch.batch_id === lastBatchId) return;
    lastBatchId = batch.batch_id;

    var image = $('processedImage');
    var viewport = $('cameraViewport');
    var indicator = $('camLiveIndicator');
    var batchImages = batch.images || [];
    var bestImage = batch.best_image || batchImages.reduce(function (best, item) {
      if (!item.annotated_url && !item.original_url) return best;
      if (!best || (Number(item.confidence) || 0) > (Number(best.confidence) || 0)) return item;
      return best;
    }, null);
    if (image && viewport && bestImage) {
      image.hidden = false;
      image.onload = function () { viewport.classList.add('has-image'); };
      image.onerror = function () { viewport.classList.remove('has-image'); };
      image.src = (bestImage.annotated_url || bestImage.original_url) + '?v=' + encodeURIComponent(batch.batch_id);
    }

    var className = batch.class_name || '';
    var categoryMap = {
      can: { category: 'LON NƯỚC', key: 'me', icon: 'can' },
      bottle: { category: 'CHAI NHỰA', key: 'pl', icon: 'bottle' },
      'paper cup': { category: 'LY GIẤY', key: 'or', icon: 'box' }
    };
    var mapped = categoryMap[className] || { category: 'CHƯA PHÂN LOẠI', key: 'pl', icon: 'bottle' };
    var time = batch.received_at ? new Date(batch.received_at).toLocaleTimeString('vi-VN') : '--';
    var confidence = Number.isFinite(Number(batch.confidence)) ? (Number(batch.confidence) * 100).toFixed(1) + '%' : '--';
    var record = {
      time: time,
      category: mapped.category,
      catKey: mapped.key,
      confidence: confidence,
      status: batch.success ? 'ĐÃ PHÂN LOẠI' : (batch.error || 'ĐÃ NHẬN ẢNH · CHƯA PHÂN LOẠI'),
      modelClass: className || 'Chưa phân loại',
      iconType: mapped.icon
    };

    if (indicator) {
      var bestConfidence = bestImage && bestImage.confidence !== null && bestImage.confidence !== undefined &&
        Number.isFinite(Number(bestImage.confidence)) ?
        (Number(bestImage.confidence) * 100).toFixed(1) + '%' : '--';
      indicator.textContent = 'ẢNH TIN CẬY CAO NHẤT · ' +
        (bestImage ? bestImage.index + '/' + (batch.frames_received || batchImages.length) : 'KHÔNG CÓ') +
        ' · ' + bestConfidence;
    }
    var frameCount = $('frameCount');
    if (frameCount) frameCount.textContent = (batch.frames_received || (batch.images || []).length || 0) + ' ảnh';
    recentActivities = [record];
    allActivities = recentActivities.slice();
    renderRecentTable();
    displayDetection(record);
    var mobileName = $('mLatestItem');
    var mobileCategory = $('mLatestCat');
    var mobileTime = $('mLatestTime');
    var mobileStatus = document.querySelector('.m-result-status-btn');
    if (mobileName) mobileName.textContent = batch.success ? mapped.category : 'Chưa phân loại';
    if (mobileCategory) mobileCategory.textContent = mapped.category;
    if (mobileTime) mobileTime.textContent = time;
    if (mobileStatus) mobileStatus.textContent = batch.success ? 'ĐÃ PHÂN LOẠI' : 'CHƯA ĐẠT ĐỒNG THUẬN';
  }

  function pollLatestBatch() {
    if (latestPollInProgress) return;
    latestPollInProgress = true;
    fetch('/api/latest', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (payload) {
        var sideStatus = $('sideOn');
        if (sideStatus) sideStatus.textContent = payload.status === 'waiting' ? 'ĐANG CHỜ ESP32' : 'ĐÃ NHẬN DỮ LIỆU';
        if (payload.status === 'waiting') {
          if (!lastBatchId) showWaitingForEsp32(payload.message);
          return;
        }
        if (payload.status === 'complete') displayLatestBatch(payload);
      })
      .catch(function () {
        if (!lastBatchId) showWaitingForEsp32('Không kết nối được backend');
      })
      .finally(function () { latestPollInProgress = false; });
  }

  /**
   * Xuất log CSV hoạt động
   */
  function exportCsvLog() {
    var csvHeader = 'Thoi_gian,Phan_loai,Do_tin_cay,Trang_thai\n';
    var csvRows = allActivities.map(function (row) {
      return [
        '"' + row.time + '"',
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

  // Khởi tạo các sự kiện khi DOM tải xong
  document.addEventListener('DOMContentLoaded', function () {
    renderRecentTable();
    showWaitingForEsp32('Đang chờ ảnh từ ESP32');
    pollLatestBatch();
    window.setInterval(pollLatestBatch, 2000);

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
          notify('Đang hiển thị kết quả phân loại: ' + act.category);
        }
      });
    }

    // Nút xuất CSV
    var btnExport = $('btnExportCsv');
    if (btnExport) {
      btnExport.addEventListener('click', exportCsvLog);
    }

    // MOBILE INTERACTIONS (Khớp ảnh mẫu Tổng Quan)
    // =========================================================================
    var btnRefresh = $('btnRefreshSensors');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', function () {
        btnRefresh.classList.add('spinning');
        btnRefresh.disabled = true;

        pollLatestBatch();
        setTimeout(function () {
          btnRefresh.classList.remove('spinning');
          btnRefresh.disabled = false;
          notify('Đã yêu cầu cập nhật kết quả mới nhất từ server.');
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
