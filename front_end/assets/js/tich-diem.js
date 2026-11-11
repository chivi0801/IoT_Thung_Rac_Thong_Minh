/**
 * ==========================================================================
 * CỔNG SINH VIÊN TÍCH ĐIỂM (tich-diem.js)
 * Quét thẻ sinh viên qua API OCR, tích điểm, đổi quà và xem lịch sử cá nhân
 * trực tiếp từ Spring Boot REST API.
 * ==========================================================================
 */

(function () {
  'use strict';

  var DEFAULT_MSSV = '21120489';

  var currentStudent = null;
  var giftsCache = [];
  var isScanning = false;

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

  function setAllText(selector, value) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.textContent = value;
    });
  }

  /* =========================================================================
     1. STUDENT PROFILE & RANK
     ========================================================================= */
  function applyProfile(profile) {
    if (!profile) return;
    currentStudent = profile;

    setAllText('.st-val-name', profile.name || '');
    setAllText('.st-val-mssv', 'MSSV: ' + (profile.mssv || ''));
    setAllText('.st-val-dept', profile.dept || '');
    setAllText('.st-val-class', profile.className || '');
    setAllText('.st-val-rank', profile.rank || '');
    setAllText('.st-val-total-points', profile.points != null ? profile.points : 0);

    var pct = profile.rankProgressPct != null ? profile.rankProgressPct : 0;
    var fill = $('rankProgressFill');
    if (fill) fill.style.width = pct + '%';

    setText('rankProgressPct', pct + '%');

    var nextPoints = profile.nextRankPoints != null ? profile.nextRankPoints : 0;
    var points = profile.points != null ? profile.points : 0;
    var remain = Math.max(0, nextPoints - points);
    setText('rankNextTip', 'Tích thêm ' + remain + ' điểm để đạt ' + (profile.nextRankName || 'hạng tiếp theo'));

    renderGiftsCatalog();
  }

  function loadStudent(mssv) {
    return window.SmartBin.request('/students/' + encodeURIComponent(mssv))
      .then(applyProfile);
  }

  /* =========================================================================
     2. PERSONAL HISTORY
     ========================================================================= */
  function renderHistoryList(items) {
    var container = $('studentHistoryList');
    if (!container) return;

    container.innerHTML = '';
    (items || []).forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'student-history-item';
      row.innerHTML =
        '<div class="hist-left">' +
          '<div class="hist-icon ' + item.type + '">' +
            (item.type === 'plastic' ? '🧃' : (item.type === 'metal' ? '🥫' : '🍌')) +
          '</div>' +
          '<div>' +
            '<div class="hist-title">' + item.title + '</div>' +
            '<div class="hist-meta">' + item.meta + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="hist-right">' +
          '<div class="hist-pts">+' + item.pts + ' đ</div>' +
          '<div class="hist-status">' + item.status + '</div>' +
        '</div>';
      container.appendChild(row);
    });

    if (!items || items.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--mut);">Chưa có lịch sử thu thập rác.</div>';
    }
  }

  function loadHistory(mssv) {
    if (!mssv) return Promise.resolve();
    return window.SmartBin.request('/students/' + encodeURIComponent(mssv) + '/history')
      .then(renderHistoryList);
  }

  /* =========================================================================
     3. GIFT CATALOG
     ========================================================================= */
  function renderGiftsCatalog() {
    var container = $('studentGiftsGrid');
    if (!container) return;

    var points = currentStudent && currentStudent.points != null ? currentStudent.points : 0;

    container.innerHTML = '';
    giftsCache.forEach(function (gift) {
      if (gift.status !== 'active') return;

      var card = document.createElement('div');
      card.className = 'student-gift-card';

      var canAfford = points >= gift.points && gift.stock > 0;
      var remainPts = gift.points - points;

      card.innerHTML =
        '<div class="gift-card-top">' +
          '<div class="gift-card-icon">' + (gift.icon || '🎁') + '</div>' +
          '<div>' +
            '<h4 class="gift-card-title">' + gift.name + '</h4>' +
            '<div class="gift-card-stock">Còn lại: ' + gift.stock + ' chiếc</div>' +
          '</div>' +
        '</div>' +
        '<div class="gift-card-desc">' + (gift.desc || 'Phần quà sinh thái khuyến khích lối sống xanh.') + '</div>' +
        '<div class="gift-card-bottom">' +
          '<div class="gift-points-price">' + gift.points + ' <small style="font-size:12px;color:var(--mut);">điểm</small></div>' +
          '<button type="button" class="btn-redeem-action" data-id="' + gift.id + '" ' + (canAfford ? '' : 'disabled') + '>' +
            (canAfford ? 'Đổi quà ngay' : (gift.stock <= 0 ? 'Hết quà' : 'Cần thêm ' + remainPts + 'đ')) +
          '</button>' +
        '</div>';

      container.appendChild(card);
    });

    if (container.children.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--mut);">Chưa có phần quà nào đang mở đổi.</div>';
    }
  }

  function loadGifts() {
    return window.SmartBin.request('/rewards/gifts')
      .then(function (gifts) {
        giftsCache = gifts || [];
        renderGiftsCatalog();
      });
  }

  /* =========================================================================
     4. OCR CARD SCANNING
     ========================================================================= */
  function handleFile(file) {
    if (!file || !file.type.match(/^image\//i)) {
      notify('Vui lòng chọn hoặc thả tệp hình ảnh hợp lệ (JPG, PNG, WEBP)!');
      return;
    }

    if (isScanning) return;

    var previewContainer = $('dropPreviewContainer');
    var previewImg = $('dropPreviewImg');
    var laser = $('scanLaserLine');
    var statusLabel = $('scanStatusOverlay');

    var reader = new FileReader();
    reader.onload = function (e) {
      var dataUrl = e.target.result;

      if (previewImg) previewImg.src = dataUrl;
      if (previewContainer) previewContainer.classList.add('active');
      if (laser) laser.classList.add('scanning');
      if (statusLabel) {
        statusLabel.textContent = 'Đang nhận diện Thẻ Sinh Viên bằng AI OCR...';
        statusLabel.style.display = 'block';
      }

      isScanning = true;

      var formData = new FormData();
      formData.append('file', file);

      window.SmartBin.request('/students/ocr-scan', {
        method: 'POST',
        body: formData
      })
        .then(function (profile) {
          applyProfile(profile);

          if (statusLabel) {
            statusLabel.textContent = 'Đã nhận diện: ' + profile.name + ' (' + profile.mssv + ')';
          }

          document.querySelectorAll('.student-avatar-box').forEach(function (box) {
            box.innerHTML = '<img src="' + dataUrl + '" alt="Ảnh thẻ">';
          });

          notify('✓ Nhận diện thành công thẻ sinh viên: ' + profile.name + ' (' + profile.mssv + ')!');
          return loadHistory(profile.mssv);
        })
        .catch(function (err) {
          if (statusLabel) statusLabel.textContent = 'Nhận diện thất bại: ' + err.message;
          notify('Không thể nhận diện thẻ: ' + err.message);
        })
        .finally(function () {
          isScanning = false;
          if (laser) laser.classList.remove('scanning');
        });
    };

    reader.readAsDataURL(file);
  }

  function resetDrop() {
    var previewContainer = $('dropPreviewContainer');
    var previewImg = $('dropPreviewImg');
    var laser = $('scanLaserLine');
    var statusLabel = $('scanStatusOverlay');
    var fileInput = $('studentFileInput');

    if (previewContainer) previewContainer.classList.remove('active');
    if (previewImg) previewImg.src = '';
    if (laser) laser.classList.remove('scanning');
    if (statusLabel) statusLabel.style.display = 'none';
    if (fileInput) fileInput.value = '';

    document.querySelectorAll('.student-avatar-box').forEach(function (box) {
      box.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    });

    notify('Đã sẵn sàng quét thẻ sinh viên tiếp theo.');
  }

  /* =========================================================================
     5. CLAIM POINTS
     ========================================================================= */
  function confirmReward() {
    if (!currentStudent) {
      notify('Vui lòng quét thẻ sinh viên trước khi tích điểm!');
      return;
    }

    var previousPoints = currentStudent.points != null ? currentStudent.points : 0;

    window.SmartBin.sendJson('/students/claim-reward', 'POST', { mssv: currentStudent.mssv })
      .then(function (profile) {
        applyProfile(profile);
        var gained = (profile.points != null ? profile.points : 0) - previousPoints;
        notify('🎉 Chúc mừng bạn ' + profile.name + ' vừa được tích +' + gained + ' Điểm Xanh!');
        return loadHistory(profile.mssv);
      })
      .catch(function (err) { notify('Không thể tích điểm: ' + err.message); });
  }

  /* =========================================================================
     6. REDEEM GIFT
     ========================================================================= */
  function redeemGift(giftId) {
    if (!currentStudent) {
      notify('Vui lòng quét thẻ sinh viên trước khi đổi quà!');
      return;
    }

    window.SmartBin.sendJson('/students/redeem', 'POST', {
      mssv: currentStudent.mssv,
      giftId: giftId
    })
      .then(function (voucher) {
        var modal = $('modalVoucher');
        if (modal) {
          setText('voucherCodeText', voucher.voucherCode);
          setText('voucherGiftName', voucher.giftName);
          setText('voucherStudentName', voucher.studentName + ' (' + voucher.mssv + ')');
          modal.classList.add('open');
        }

        notify('🎉 ' + (voucher.message || ('Đổi quà thành công! Mã voucher ' + voucher.voucherCode)));

        return Promise.all([
          loadStudent(currentStudent.mssv),
          loadGifts(),
          loadHistory(currentStudent.mssv)
        ]);
      })
      .catch(function (err) { notify('Không thể đổi quà: ' + err.message); });
  }

  /* =========================================================================
     7. TAB & DROP ZONE EVENTS
     ========================================================================= */
  function setupTabs() {
    var tabBtns = document.querySelectorAll('.portal-tabs-nav .tab-btn');
    var tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var targetId = btn.getAttribute('data-tab');

        tabBtns.forEach(function (b) { b.classList.remove('active'); });
        tabContents.forEach(function (c) { c.classList.remove('active'); });

        btn.classList.add('active');
        var targetContent = $(targetId);
        if (targetContent) targetContent.classList.add('active');
      });
    });
  }

  function setupDropZone() {
    var zone = $('studentDropZone');
    var fileInput = $('studentFileInput');
    var btnUpload = $('btnUploadFile');

    if (!zone) return;

    if (btnUpload && fileInput) {
      btnUpload.addEventListener('click', function (e) {
        e.stopPropagation();
        fileInput.click();
      });
    }

    zone.addEventListener('click', function () {
      if (fileInput) fileInput.click();
    });

    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files.length) {
          handleFile(e.target.files[0]);
        }
      });
    }

    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', function (e) {
      e.preventDefault();
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
      }
    });
  }

  /* =========================================================================
     8. INITIALISATION
     ========================================================================= */
  function init() {
    setupDropZone();
    setupTabs();

    Promise.all([loadStudent(DEFAULT_MSSV), loadGifts()])
      .then(function () {
        if (currentStudent) return loadHistory(currentStudent.mssv);
      })
      .catch(function (err) {
        notify('Không thể tải dữ liệu cổng sinh viên: ' + err.message);
      });

    document.addEventListener('click', function (e) {
      if (e.target.closest('.btn-confirm-reward')) {
        confirmReward();
        return;
      }
      if (e.target.closest('.btn-reset-drop')) {
        resetDrop();
        return;
      }
      var redeemBtn = e.target.closest('.btn-redeem-action');
      if (redeemBtn && !redeemBtn.disabled) {
        redeemGift(parseInt(redeemBtn.getAttribute('data-id'), 10));
        return;
      }
      if (e.target && (e.target.id === 'btnCloseVoucher' || e.target.id === 'modalVoucher')) {
        var modal = $('modalVoucher');
        if (modal) modal.classList.remove('open');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.StudentPortal = {
    handleFile: handleFile,
    confirmReward: confirmReward,
    redeemGift: redeemGift,
    resetDrop: resetDrop,
    updateUi: function () { if (currentStudent) applyProfile(currentStudent); }
  };
})();
