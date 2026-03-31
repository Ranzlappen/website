/**
 * Media Carousel — auto-initialises every .carousel wrapper in the page.
 *
 * Usage in Markdown / HTML:
 *   <div class="carousel">
 *     ![Alt text](/path/to/img1.jpg)
 *     ![Alt text](/path/to/video.mp4)
 *   </div>
 *
 * Supports: images, videos (mp4/webm/ogg), arrows, dot indicators,
 * keyboard (←/→), touch/swipe, pause-on-hover, responsive sizing,
 * and optional captions from alt text.
 */
(function () {
  'use strict';

  var SWIPE_THRESHOLD = 40;
  var AUTO_INTERVAL = 5000;
  var VIDEO_EXTENSIONS = /\.(mp4|webm|ogg)(\?.*)?$/i;

  function isVideoSource(src) {
    return VIDEO_EXTENSIONS.test(src);
  }

  function getSlideVideo(slide) {
    return slide.dataset.isVideo === 'true' ? slide.querySelector('video') : null;
  }

  function initCarousel(wrapper) {
    /* ── Collect images & build DOM ─────────────────────────── */
    var imgs = Array.prototype.slice.call(wrapper.querySelectorAll('img'));
    if (imgs.length === 0) return;

    // Clear original content (paragraphs wrapping imgs, bare text nodes, etc.)
    wrapper.innerHTML = '';
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-roledescription', 'carousel');
    wrapper.setAttribute('aria-label', 'Media carousel');
    wrapper.setAttribute('tabindex', '0');

    // Track
    var track = document.createElement('div');
    track.className = 'carousel__track';

    var slides = [];
    imgs.forEach(function (img, i) {
      var slide = document.createElement('div');
      slide.className = 'carousel__slide';
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', 'Slide ' + (i + 1) + ' of ' + imgs.length);

      var media;
      var altText = (img.alt || '').trim();
      var src = img.getAttribute('src') || img.src;

      if (isVideoSource(src)) {
        var video = document.createElement('video');
        video.src = src;
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        video.muted = true;
        video.setAttribute('loop', '');
        video.setAttribute('controls', '');
        video.setAttribute('preload', 'metadata');
        video.setAttribute('draggable', 'false');
        if (altText) video.setAttribute('aria-label', altText);
        slide.dataset.isVideo = 'true';
        media = video;
      } else {
        img.setAttribute('draggable', 'false');
        img.loading = 'lazy';
        media = img;
      }

      slide.appendChild(media);

      // Caption from alt text
      if (altText) {
        var cap = document.createElement('span');
        cap.className = 'carousel__caption';
        cap.textContent = altText;
        slide.appendChild(cap);
      }

      track.appendChild(slide);
      slides.push(slide);
    });

    wrapper.appendChild(track);

    /* ── Counter ────────────────────────────────────────────── */
    var counter = document.createElement('span');
    counter.className = 'carousel__counter';
    counter.setAttribute('aria-live', 'polite');
    wrapper.appendChild(counter);

    /* ── Arrows ─────────────────────────────────────────────── */
    var prevBtn = makeArrow('prev', '&#8249;', 'Previous slide');
    var nextBtn = makeArrow('next', '&#8250;', 'Next slide');
    wrapper.appendChild(prevBtn);
    wrapper.appendChild(nextBtn);

    /* ── Dots ───────────────────────────────────────────────── */
    var dotsWrap = document.createElement('div');
    dotsWrap.className = 'carousel__dots';
    dotsWrap.setAttribute('role', 'tablist');
    var dots = [];
    slides.forEach(function (_, i) {
      var btn = document.createElement('button');
      btn.className = 'carousel__dot';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      btn.addEventListener('click', function () { goTo(i); });
      dotsWrap.appendChild(btn);
      dots.push(btn);
    });
    wrapper.appendChild(dotsWrap);

    /* ── State ──────────────────────────────────────────────── */
    var current = 0;
    var paused = false;
    var autoTimer = null;

    function goTo(index) {
      if (index < 0) index = slides.length - 1;
      if (index >= slides.length) index = 0;

      // Pause video on the slide we're leaving
      var leavingVideo = getSlideVideo(slides[current]);
      if (leavingVideo) {
        leavingVideo.pause();
        leavingVideo.currentTime = 0;
      }

      current = index;
      track.style.transform = 'translateX(-' + (current * 100) + '%)';
      dots.forEach(function (d, i) {
        d.classList.toggle('carousel__dot--active', i === current);
        d.setAttribute('aria-selected', i === current ? 'true' : 'false');
      });
      counter.textContent = (current + 1) + ' / ' + slides.length;

      // Play video on the new active slide
      var enteringVideo = getSlideVideo(slides[current]);
      if (enteringVideo && !paused) {
        enteringVideo.play().catch(function () {});
      }

      resetAuto();
    }

    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }

    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);

    /* ── Auto-play ──────────────────────────────────────────── */
    function startAuto() {
      stopAuto();
      if (!paused) {
        autoTimer = setInterval(function () {
          var currentVideo = getSlideVideo(slides[current]);
          if (currentVideo && !currentVideo.paused && !currentVideo.ended) return;
          next();
        }, AUTO_INTERVAL);
      }
    }
    function stopAuto() { clearInterval(autoTimer); autoTimer = null; }
    function resetAuto() { stopAuto(); startAuto(); }

    wrapper.addEventListener('mouseenter', function () {
      paused = true;
      stopAuto();
      var v = getSlideVideo(slides[current]);
      if (v) v.pause();
    });
    wrapper.addEventListener('mouseleave', function () {
      paused = false;
      startAuto();
      var v = getSlideVideo(slides[current]);
      if (v) v.play().catch(function () {});
    });

    /* ── Keyboard ───────────────────────────────────────────── */
    wrapper.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    });

    /* ── Touch / swipe ──────────────────────────────────────── */
    var touchStartX = 0;
    var touchStartY = 0;
    var isSwiping = false;

    wrapper.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
      isSwiping = false;
    }, { passive: true });

    wrapper.addEventListener('touchmove', function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        isSwiping = true;
      }
    }, { passive: true });

    wrapper.addEventListener('touchend', function (e) {
      if (!isSwiping) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (dx > SWIPE_THRESHOLD) prev();
      else if (dx < -SWIPE_THRESHOLD) next();
    });

    /* ── Init ───────────────────────────────────────────────── */
    goTo(0);
    startAuto();
  }

  /* ── Helpers ────────────────────────────────────────────── */
  function makeArrow(dir, html, label) {
    var btn = document.createElement('button');
    btn.className = 'carousel__arrow carousel__arrow--' + dir;
    btn.innerHTML = html;
    btn.setAttribute('aria-label', label);
    btn.type = 'button';
    return btn;
  }

  /* ── Boot ───────────────────────────────────────────────── */
  function boot() {
    var carousels = document.querySelectorAll('.carousel');
    for (var i = 0; i < carousels.length; i++) initCarousel(carousels[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
