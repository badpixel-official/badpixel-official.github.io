/* ========================================
   BADPIXEL — Halftone Dot Transition
   Three.js + html2canvas + GLSL shader
   ======================================== */

(function() {
  'use strict';

  if (typeof THREE === 'undefined') {
    console.warn('Three.js not loaded — transitions disabled');
    return;
  }

  /* ================================================
     GLSL Shaders — Halftone Dot Effect
     ================================================ */
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform sampler2D texFrom;
    uniform sampler2D texTo;
    uniform float progress;
    uniform vec2 resolution;
    uniform float dotSize;
    varying vec2 vUv;

    // Perceived brightness (ITU-R BT.601)
    float luminance(vec3 c) {
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    // Halftone dot: returns 1.0 inside dot, 0.0 outside
    float halftone(vec2 uv, vec2 res, float size, float brightness) {
      // Convert UV to pixel coords, then to grid cell
      vec2 pixelCoord = uv * res;
      vec2 cell = floor(pixelCoord / size) * size + size * 0.5; // cell center
      float dist = length(pixelCoord - cell);

      // Dot radius proportional to brightness (dark = big dot, bright = small)
      float maxRadius = size * 0.55;
      float radius = maxRadius * (1.0 - brightness);

      // Anti-aliased edge
      return 1.0 - smoothstep(radius - 1.0, radius + 1.0, dist);
    }

    // Brand RGB color based on cell position
    vec3 brandColor(vec2 uv) {
      float n = fract(sin(dot(floor(uv * 30.0), vec2(12.9898, 78.233))) * 43758.5453);
      if (n < 0.33) return vec3(1.0, 0.125, 0.125);  // Red  #FF2020
      if (n < 0.66) return vec3(0.0, 1.0, 0.255);     // Green #00FF41
      return vec3(0.0, 0.4, 1.0);                      // Blue  #0066FF
    }

    void main() {
      vec4 colFrom = texture2D(texFrom, vUv);
      vec4 colTo = texture2D(texTo, vUv);

      // === Phase logic ===
      // 0.0 → 0.5: "from" image dissolves into halftone dots then fades
      // 0.5 → 1.0: "to" image appears from halftone dots then sharpens

      if (progress < 0.5) {
        // Phase 1: texFrom → halftone → fade out
        float phase = progress * 2.0; // 0→1 within this half

        float lum = luminance(colFrom.rgb);
        float dot = halftone(vUv, resolution, dotSize, lum);

        // Halftone intensity increases with phase
        float halftoneStrength = smoothstep(0.0, 0.4, phase);
        // Then dots shrink and fade
        float dotFade = 1.0 - smoothstep(0.5, 1.0, phase);

        // Mix between original and halftone version
        vec3 dotColor = brandColor(vUv);
        vec3 halftoned = dot * dotColor * dotFade;
        vec3 bg = vec3(0.04); // near-black background behind dots

        // Blend: original → halftone dots on dark bg
        vec3 result = mix(colFrom.rgb, mix(bg, halftoned, dot * dotFade), halftoneStrength);
        gl_FragColor = vec4(result, 1.0);

      } else {
        // Phase 2: halftone dots → texTo appears
        float phase = (progress - 0.5) * 2.0; // 0→1 within this half

        float lum = luminance(colTo.rgb);
        float dot = halftone(vUv, resolution, dotSize, lum);

        // Dots appear first, then transition to full image
        float dotAppear = 1.0 - smoothstep(0.0, 0.5, phase);
        float imageReveal = smoothstep(0.3, 1.0, phase);

        vec3 dotColor = brandColor(vUv);
        vec3 halftoned = dot * dotColor * dotAppear;
        vec3 bg = vec3(0.04);

        // Blend: halftone dots on dark bg → original image
        vec3 dotLayer = mix(bg, halftoned, dot * dotAppear);
        vec3 result = mix(dotLayer, colTo.rgb, imageReveal);
        gl_FragColor = vec4(result, 1.0);
      }
    }
  `;

  /* ================================================
     Three.js Scene Setup
     ================================================ */
  const canvas = document.getElementById('transition-canvas');
  if (!canvas) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = window.innerWidth;
  let H = window.innerHeight;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const scene = new THREE.Scene();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      texFrom: { value: null },
      texTo: { value: null },
      progress: { value: 0 },
      resolution: { value: new THREE.Vector2(W * dpr, H * dpr) },
      dotSize: { value: 8.0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(mesh);

  /* ================================================
     Texture Cache (LRU, max 4)
     ================================================ */
  const textureCache = new Map();
  const MAX_CACHE = 4;

  function cacheTexture(key, texture) {
    if (textureCache.size >= MAX_CACHE) {
      const oldest = textureCache.keys().next().value;
      textureCache.get(oldest).dispose();
      textureCache.delete(oldest);
    }
    textureCache.set(key, texture);
  }

  function getCachedTexture(key) {
    if (textureCache.has(key)) {
      const tex = textureCache.get(key);
      textureCache.delete(key);
      textureCache.set(key, tex);
      return tex;
    }
    return null;
  }

  function invalidateCache(key) {
    if (key) {
      if (textureCache.has(key)) {
        textureCache.get(key).dispose();
        textureCache.delete(key);
      }
    } else {
      textureCache.forEach(t => t.dispose());
      textureCache.clear();
    }
  }

  /* ================================================
     DOM → Texture Capture
     ================================================ */
  async function captureElement(el, key) {
    const cached = getCachedTexture(key);
    if (cached) return cached;

    if (typeof html2canvas === 'undefined') {
      console.warn('html2canvas not loaded');
      return createFallbackTexture();
    }

    const captureCanvas = await html2canvas(el, {
      scale: dpr,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: W,
      height: H,
      logging: false,
    });

    const texture = new THREE.CanvasTexture(captureCanvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    cacheTexture(key, texture);
    return texture;
  }

  function createFallbackTexture() {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 2;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 2, 2);
    return new THREE.CanvasTexture(c);
  }

  /* ================================================
     Animation
     ================================================ */
  let animating = false;
  let animationId = null;

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function animate(duration, onComplete) {
    const start = performance.now();
    canvas.classList.add('active');

    function frame(now) {
      const elapsed = now - start;
      const raw = Math.min(elapsed / duration, 1);
      material.uniforms.progress.value = easeInOutCubic(raw);
      renderer.render(scene, camera);

      if (raw < 1) {
        animationId = requestAnimationFrame(frame);
      } else {
        canvas.classList.remove('active');
        animating = false;
        if (onComplete) onComplete();
      }
    }

    animating = true;
    animationId = requestAnimationFrame(frame);
  }

  /* ================================================
     Public API
     ================================================ */
  async function run(fromEl, toEl, fromKey, toKey, options = {}) {
    if (animating) return;

    const {
      duration = 1400,
      dotSize = 8.0,
      onSwitch,
    } = options;

    // Capture "from"
    const texFrom = await captureElement(fromEl, fromKey);

    // Capture "to" (temporarily show)
    const wasActive = toEl.classList.contains('active');
    if (!wasActive) {
      toEl.style.opacity = '0';
      toEl.classList.add('active');
    }
    invalidateCache(toKey);
    const texTo = await captureElement(toEl, toKey);
    if (!wasActive) {
      toEl.classList.remove('active');
      toEl.style.opacity = '';
    }

    // Set uniforms
    material.uniforms.texFrom.value = texFrom;
    material.uniforms.texTo.value = texTo;
    material.uniforms.progress.value = 0;
    material.uniforms.dotSize.value = dotSize;

    return new Promise((resolve) => {
      if (onSwitch) onSwitch();
      animate(duration, resolve);
    });
  }

  /* ================================================
     Resize Handler
     ================================================ */
  window.addEventListener('resize', () => {
    W = window.innerWidth;
    H = window.innerHeight;
    renderer.setSize(W, H);
    material.uniforms.resolution.value.set(W * dpr, H * dpr);
    invalidateCache();
  });

  /* ================================================
     Expose
     ================================================ */
  window.PixelDisplacementTransition = {
    run,
    invalidateCache,
    isAnimating: () => animating,
  };

})();
