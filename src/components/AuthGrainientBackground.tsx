import { useEffect, useRef } from "react";
import { DEFAULT_PALETTE, type MeshPalette } from "@/lib/weatherPalette";

/**
 * Grainy-gradient backdrop for the auth pages. Drop-in replacement (same
 * `{ palette }` contract) — the three gradient colors track time-of-day +
 * weather, but are anchored to LIGHT warm brand tones so the field stays subtle
 * and never drifts cool/grey. Opaque, so it is the background itself.
 *
 * This is the reactbits.dev "Grainient" shader ported to raw WebGL2: the
 * original uses `ogl`, which fights Turbopack (same class of failure as
 * three/r3f). Raw WebGL2 runs the identical GLSL in a canvas + rAF — no deps,
 * no SSR crash. Honors prefers-reduced-motion (one static frame, no loop).
 */

const VERT = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

// reactbits Grainient fragment shader (verbatim mainImage/noise).
const FRAG = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uTimeSpeed;
uniform float uColorBalance;
uniform float uWarpStrength;
uniform float uWarpFrequency;
uniform float uWarpSpeed;
uniform float uWarpAmplitude;
uniform float uBlendAngle;
uniform float uBlendSoftness;
uniform float uRotationAmount;
uniform float uNoiseScale;
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainAnimated;
uniform float uContrast;
uniform float uGamma;
uniform float uSaturation;
uniform vec2 uCenterOffset;
uniform float uZoom;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
out vec4 fragColor;
#define S(a,b,t) smoothstep(a,b,t)
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}
void mainImage(out vec4 o, vec2 C){
  float t=iTime*uTimeSpeed;
  vec2 uv=C/iResolution.xy;
  float ratio=iResolution.x/iResolution.y;
  vec2 tuv=uv-0.5+uCenterOffset;
  tuv/=max(uZoom,0.001);
  float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);
  tuv.y*=1.0/ratio;
  tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));
  tuv.y*=ratio;
  float frequency=uWarpFrequency;
  float ws=max(uWarpStrength,0.001);
  float amplitude=uWarpAmplitude/ws;
  float warpTime=t*uWarpSpeed;
  tuv.x+=sin(tuv.y*frequency+warpTime)/amplitude;
  tuv.y+=sin(tuv.x*(frequency*1.5)+warpTime)/(amplitude*0.5);
  vec3 colLav=uColor1;
  vec3 colOrg=uColor2;
  vec3 colDark=uColor3;
  float b=uColorBalance;
  float s=max(uBlendSoftness,0.0);
  mat2 blendRot=Rot(radians(uBlendAngle));
  float blendX=(tuv*blendRot).x;
  float edge0=-0.3-b-s;
  float edge1=0.2-b+s;
  float v0=0.5-b+s;
  float v1=-0.3-b-s;
  vec3 layer1=mix(colDark,colOrg,S(edge0,edge1,blendX));
  vec3 layer2=mix(colOrg,colLav,S(edge0,edge1,blendX));
  vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));
  vec2 grainUv=uv*max(uGrainScale,0.001);
  if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);}
  float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);
  col+=(grain-0.5)*uGrainAmount;
  col=(col-0.5)*uContrast+0.5;
  float luma=dot(col,vec3(0.2126,0.7152,0.0722));
  col=mix(vec3(luma),col,uSaturation);
  col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));
  col=clamp(col,0.0,1.0);
  o=vec4(col,1.0);
}
void main(){ vec4 o=vec4(0.0); mainImage(o,gl_FragCoord.xy); fragColor=o; }
`;

function rgb01(rgba: string, fallback: [number, number, number]): [number, number, number] {
  const m = /(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(rgba);
  return m ? [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255] : fallback;
}

// Light warm brand anchors. Weather still nudges the hue, but only ~18% — so the
// field reads pale sage / terracotta / cream and never cools to grey.
const BRAND_BIAS = 0.82;
const LIGHT_SAGE: [number, number, number] = [0.85, 0.86, 0.79];
const LIGHT_TERRA: [number, number, number] = [0.9, 0.79, 0.71];
const LIGHT_CREAM: [number, number, number] = [0.96, 0.94, 0.89];
function stop(live: string, anchor: [number, number, number], fallback: [number, number, number]): [number, number, number] {
  const a = rgb01(live, fallback);
  return [
    a[0] + (anchor[0] - a[0]) * BRAND_BIAS,
    a[1] + (anchor[1] - a[1]) * BRAND_BIAS,
    a[2] + (anchor[2] - a[2]) * BRAND_BIAS,
  ];
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

// Subtle, calm brand tuning (defaults trimmed way down from the reactbits demo).
const PARAMS: Record<string, number> = {
  uTimeSpeed: 0.06,
  uColorBalance: 0.0,
  uWarpStrength: 1.0,
  uWarpFrequency: 3.0,
  uWarpSpeed: 1.0,
  uWarpAmplitude: 140.0, // higher denom → gentler warp
  uBlendAngle: 0.0,
  uBlendSoftness: 0.2,
  uRotationAmount: 45.0, // was 500 — far calmer motion
  uNoiseScale: 2.0,
  uGrainAmount: 0.06,
  uGrainScale: 2.0,
  uGrainAnimated: 0.0,
  uContrast: 1.05,
  uGamma: 1.0,
  uSaturation: 0.85,
  uZoom: 0.9,
};

export function AuthGrainientBackground({
  className = "",
  palette = DEFAULT_PALETTE,
}: Readonly<{
  className?: string;
  palette?: MeshPalette;
}>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2");
    if (!gl) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    for (const [name, value] of Object.entries(PARAMS)) {
      gl.uniform1f(gl.getUniformLocation(prog, name), value);
    }
    gl.uniform2f(gl.getUniformLocation(prog, "uCenterOffset"), 0, 0);
    gl.uniform3fv(gl.getUniformLocation(prog, "uColor1"), stop(palette.c1, LIGHT_SAGE, LIGHT_SAGE));
    gl.uniform3fv(gl.getUniformLocation(prog, "uColor2"), stop(palette.c2, LIGHT_TERRA, LIGHT_TERRA));
    gl.uniform3fv(gl.getUniformLocation(prog, "uColor3"), stop(palette.c3, LIGHT_CREAM, LIGHT_CREAM));
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uRes = gl.getUniformLocation(prog, "iResolution");

    const reduced = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    }

    function draw(t: number) {
      gl.uniform1f(uTime, t * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    resize();
    if (reduced) {
      draw(1000);
    } else {
      const loop = (t: number) => {
        draw(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    const onResize = () => {
      resize();
      if (reduced) draw(1000);
    };
    window.addEventListener("resize", onResize);

    const onVisibility = () => {
      if (reduced) return;
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        raf = requestAnimationFrame(function loop(t) {
          draw(t);
          raf = requestAnimationFrame(loop);
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [palette]);

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
