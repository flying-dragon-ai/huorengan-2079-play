// 后期用的两个 ShaderPass 着色器：防黑屏的颜色限幅、以及调色/低分辨率/暗角/颗粒
import * as THREE from 'three';

/**
 * 防黑屏二：渲染完先把颜色限住（无穷大压到 200，NaN 变 0），再交给辉光和调色。
 * @type {{uniforms: Record<string, {value: any}>, vertexShader: string, fragmentShader: string}}
 */
export const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 200.0), c.a);
    }`,
};

/**
 * 调色：饱和度、青橙分离、360P 灰盒（uLow / uReveal）、色差、暗角、颗粒、黑边、闪白。
 * uniforms 由 Pipeline 每帧写：uTime / uRes / uLow / uReveal / uPix / uSat / uVig / uGrain / uCA / uFlash / uLetter / uWarm。
 * @type {{uniforms: Record<string, {value: any}>, vertexShader: string, fragmentShader: string}}
 */
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uLow: { value: 0 }, uReveal: { value: 0 }, uPix: { value: 3 }, uSat: { value: 1.08 },
    uVig: { value: 0.55 }, uGrain: { value: 0.013 }, uCA: { value: 0.075 }, uFlash: { value: 0 },
    uLetter: { value: 0 }, uWarm: { value: 1 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uLow, uReveal, uPix, uSat, uVig, uGrain, uCA, uFlash, uLetter, uWarm;
    uniform vec2 uRes; varying vec2 vUv;
    void main(){
      vec2 uv = vUv; vec2 c = uv - 0.5;
      float d = length(c * vec2(uRes.x / uRes.y, 1.0));
      float low = uLow * smoothstep(uReveal - 0.04, uReveal + 0.04, d);
      vec2 puv = uv;
      if (low > 0.5) { vec2 g = uRes / uPix; puv = (floor(uv * g) + 0.5) / g; }
      vec2 dir = c * uCA * 0.012 * (1.0 + low * 2.0);
      vec3 col = vec3(texture2D(tDiffuse, puv + dir).r, texture2D(tDiffuse, puv).g, texture2D(tDiffuse, puv - dir).b);
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.45) * 1.1 + 0.45;
      // 青橙分离：亮部偏暖，暗部偏青
      col += vec3(0.06, 0.025, -0.02) * smoothstep(0.35, 1.0, l) * uWarm;
      col += vec3(-0.015, 0.008, 0.03) * (1.0 - smoothstep(0.0, 0.35, l));
      // 360P 灰盒
      col = mix(col, vec3(l * 0.85 + 0.06), low * 0.95);
      float edge = smoothstep(0.05, 0.0, abs(d - uReveal)) * step(0.01, uLow);
      col += vec3(0.35, 0.95, 1.0) * edge * 0.9;
      col *= mix(1.0, 1.0 - smoothstep(0.35, 1.05, d) * 0.85, uVig);
      float n = fract(sin(dot(uv * uRes + fract(uTime) * 91.0, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * uGrain;
      float lb = 0.5 - uLetter * 0.11;
      if (abs(uv.y - 0.5) > lb) col = vec3(0.0);
      col = mix(col, vec3(1.0), uFlash);
      gl_FragColor = vec4(col, 1.0);
    }`,
};
