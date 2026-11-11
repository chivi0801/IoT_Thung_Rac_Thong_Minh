/**
 * ==========================================================================
 * THIẾT BỊ & PHÂN LOẠI JAVASCRIPT (thiet-bi.js)
 * Hiển thị trạng thái ba cảm biến khoảng cách và batch phân loại thật từ backend.
 * ==========================================================================
 */

(function () {
  'use strict';

  // Dữ liệu thực từ ESP32 qua Flask endpoint /api/bins.
  var cps = [
    { id: 1, key: 'or', sensorName: 'giay', name: 'NGĂN LY GIẤY', level: null, distanceMm: null, sensorOk: false },
    { id: 2, key: 'pl', sensorName: 'nhua', name: 'NGĂN CHAI NHỰA', level: null, distanceMm: null, sensorOk: false },
    { id: 3, key: 'me', sensorName: 'kim_loai', name: 'NGĂN LON NƯỚC', level: null, distanceMm: null, sensorOk: false }
  ];

  var cfgDef = { full: 80, conf: 60 };
  var cfg = { full: 80, conf: 60 };
  var polling = false;
  var latestPredictionPolling = false;
  var latestBatchId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function notify(msg) {
    if (window.SmartBin && typeof window.SmartBin.toast === 'function') {
      window.SmartBin.toast(msg);
    }
  }

  function formatNowTime() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function getCompartmentStatus(compartment) {
    if (!compartment.sensorOk || compartment.level === null) return { c: 'unknown', t: 'CHƯA CÓ SỐ ĐO' };
    var level = compartment.level;
    if (level >= 95) return { c: 'bad', t: 'ĐẦY' };
    if (level >= cfg.full) return { c: 'warn', t: 'SẮP ĐẦY' };
    return { c: 'ok', t: 'BÌNH THƯỜNG' };
  }

  /**
   * Render các thẻ ngăn rác trên Desktop
   */
  function renderCompartments() {
    var cpsEl = $('cps');
    if (!cpsEl) return;

    var full = [];
    var html = '';

    cps.forEach(function (c) {
      var st = getCompartmentStatus(c);
      if (st.c !== 'ok') {
        if (st.c === 'bad' || st.c === 'warn') {
          full.push('Ngăn ' + c.id + ' ' + (st.c === 'bad' ? 'đã đầy' : 'sắp đầy (' + c.level + '%)'));
        }
      }
      var levelText = c.level === null ? '—' : c.level;
      var levelWidth = c.level === null ? 0 : c.level;
      var distanceText = c.distanceMm === null ? '—' : (c.distanceMm / 10).toFixed(1) + ' cm';
      var sensorText = !c.sensorOk ? 'Không phản hồi' : (c.level === null ? 'Chưa có số đo' : 'Đang hoạt động');

      html += '<article id="ngan-' + c.id + '" class="card cp ' + c.key + '">' +
        '<h3>' + c.name + '</h3>' +
        '<div class="big mono">' + levelText + (c.level === null ? '' : '<small>%</small>') + '</div>' +
        '<span class="pill s-' + st.c + '">' + st.t + '</span>' +
        '<div class="bar ' + (st.c === 'ok' ? '' : st.c) + '" role="progressbar" aria-valuenow="' + levelWidth + '" aria-valuemin="0" aria-valuemax="100">' +
          '<span style="width:' + levelWidth + '%"></span>' +
        '</div>' +
        '<div class="scale"><span>0%</span><span>' + cfg.full + '%</span><span>100%</span></div>' +
        '<div class="meta"><span>Cách cảm biến</span><b>' + distanceText + '</b></div>' +
        '<div class="meta" style="margin-top:-6px;border:0;padding:0"><span>Cảm biến</span><b>' + sensorText + '</b></div>' +
      '</article>';
    });

    cpsEl.innerHTML = html;

    // Cập nhật Banner cảnh báo
    var banner = $('banner');
    var bannerTx = $('bannerTx');

    if (banner && bannerTx) {
      banner.classList.toggle('show', full.length > 0);
      bannerTx.textContent = full.join(' · ') + (full.length > 0 ? '. Cần đổ rác sớm.' : '');
    }
  }

  function pollBinReadings() {
    if (polling) return;
    polling = true;
    fetch('/api/bins', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (payload) {
        if (!payload || !Array.isArray(payload.bins)) throw new Error('Dữ liệu cảm biến không hợp lệ');
        var readings = {};
        payload.bins.forEach(function (item) { readings[item.name] = item; });
        cps.forEach(function (c) {
          var reading = readings[c.sensorName];
          c.sensorOk = !!(reading && reading.sensor_ok);
          c.level = c.sensorOk && reading.fill_percent !== null && reading.fill_percent !== undefined && Number.isFinite(Number(reading.fill_percent)) ?
            Math.max(0, Math.min(100, Number(reading.fill_percent))) : null;
          c.distanceMm = c.sensorOk && reading.distance_mm !== null && reading.distance_mm !== undefined && Number.isFinite(Number(reading.distance_mm)) ?
            Number(reading.distance_mm) : null;
        });
        var status = $('sensorConnection');
        if (status) {
          var readyCount = cps.filter(function (c) { return c.sensorOk; }).length;
          status.textContent = 'ESP32 trực tuyến · ' + readyCount + '/3 cảm biến sẵn sàng · cập nhật ' +
            new Date().toLocaleTimeString('vi-VN');
          status.classList.toggle('offline', readyCount === 0);
        }
        renderCompartments();
        var sideStatus = $('sideOn');
        var deviceStatus = $('devOn');
        if (sideStatus) sideStatus.textContent = 'ONLINE';
        if (deviceStatus) deviceStatus.textContent = 'ESP32 · ' + cps.filter(function (c) { return c.sensorOk; }).length + '/3 cảm biến sẵn sàng';
      })
      .catch(function (error) {
        var status = $('sensorConnection');
        if (status) {
          status.textContent = 'Không đọc được ESP32: ' + error.message;
          status.classList.add('offline');
          var sideStatus = $('sideOn');
          var deviceStatus = $('devOn');
          if (sideStatus) sideStatus.textContent = 'OFFLINE';
          if (deviceStatus) deviceStatus.textContent = 'MẤT KẾT NỐI';
        }
      })
      .finally(function () { polling = false; });
  }

  function pollLatestPrediction() {
    if (latestPredictionPolling) return;
    latestPredictionPolling = true;
    fetch('/api/latest', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (payload) {
        if (payload.status !== 'complete' || payload.batch_id === latestBatchId) return;
        latestBatchId = payload.batch_id;

        var frame = $('liveFeedViewport');
        var image = $('latestWasteImage');
        var firstImage = (payload.images || []).find(function (item) {
          return item.annotated_url || item.original_url;
        });
        if (frame && image && firstImage) {
          image.hidden = false;
          image.onload = function () { frame.classList.add('has-image'); };
          image.onerror = function () { frame.classList.remove('has-image'); };
          image.src = (firstImage.annotated_url || firstImage.original_url) + '?v=' + encodeURIComponent(payload.batch_id);
        }

        var types = {
          can: { name: 'Lon nước', category: 'LON NƯỚC' },
          bottle: { name: 'Chai nhựa', category: 'CHAI NHỰA' },
          'paper cup': { name: 'Ly giấy', category: 'LY GIẤY' }
        };
        var type = types[payload.class_name] || { name: 'Chưa phân loại', category: 'CHƯA PHÂN LOẠI' };
        var confidence = Number.isFinite(Number(payload.confidence)) ? (Number(payload.confidence) * 100).toFixed(1) + '%' : '--';
        var receivedAt = payload.received_at ? new Date(payload.received_at).toLocaleString('vi-VN') : '--';
        var targetName = $('targetObjectName');
        var targetConfidence = $('targetAiConf');
        var categoryBadge = $('valCategoryBadge');
        var timestamp = $('valTimestamp');
        var stepConfidence = $('stepConf2');
        var flapStatus = document.querySelector('.success-badge');

        if (targetName) targetName.textContent = type.name;
        if (targetConfidence) targetConfidence.textContent = payload.success ? 'YOLO ' + confidence : (payload.error || 'Chưa phân loại');
        if (categoryBadge) categoryBadge.textContent = type.category;
        if (timestamp) timestamp.textContent = receivedAt;
        if (stepConfidence) stepConfidence.textContent = payload.success ? 'YOLO ' + confidence : 'Chưa đạt đồng thuận';
        if (flapStatus) flapStatus.textContent = payload.success ? 'ĐÃ GỬI LỆNH PHÂN LOẠI' : 'CHƯA PHÂN LOẠI';
      })
      .catch(function (error) {
        var targetName = $('targetObjectName');
        if (!latestBatchId && targetName) targetName.textContent = 'Đang chờ ESP32 gửi ảnh';
        if (error && window.console) console.warn('Không đọc được kết quả ESP32:', error.message);
      })
      .finally(function () { latestPredictionPolling = false; });
  }

  /**
   * Đồng hồ cập nhật thời gian uptime và thời điểm liên lạc gần nhất
   */
  // Khởi chạy khi DOM sẵn sàng
  document.addEventListener('DOMContentLoaded', function () {
    renderCompartments();
    pollBinReadings();
    window.setInterval(pollBinReadings, 2000);
    pollLatestPrediction();
    window.setInterval(pollLatestPrediction, 2000);



  });
})();
