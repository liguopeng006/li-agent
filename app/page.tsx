"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  CircleHelp,
  Clock3,
  Feather,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

type Scene = "ideal" | "vacuum" | "air";
type Sample = { t: number; v: number; h: number };
type DropState = { t: number; v: number; h: number };

const SCENE_COPY: Record<Scene, { label: string; note: string }> = {
  ideal: { label: "理想自由落体", note: "一个物体从静止释放，只受重力作用。" },
  vacuum: { label: "真空对比", note: "羽毛和小球都不受空气阻力，一起下落。" },
  air: { label: "真实空气中", note: "小球和羽毛受到不同程度的空气阻力。" },
};

function fallTime(height: number, g: number) {
  return Math.sqrt((2 * height) / g);
}

function landingTime(height: number, g: number, drag: number) {
  if (!drag) return fallTime(height, g);
  const step = 0.005;
  let t = 0;
  let v = 0;
  let h = 0;
  while (h < height) {
    v += Math.max(0, g - drag * v * v) * step;
    h += v * step;
    t += step;
  }
  return t;
}

function getDropAt(time: number, height: number, g: number, drag: number): DropState {
  if (!drag) {
    const t = Math.min(time, fallTime(height, g));
    return { t, v: g * t, h: Math.min(height, (g * t * t) / 2) };
  }

  const step = 0.005;
  let t = 0;
  let v = 0;
  let h = 0;
  while (t < time && h < height) {
    const dt = Math.min(step, time - t);
    const acceleration = Math.max(0, g - drag * v * v);
    v = Math.min(80, v + acceleration * dt);
    h += v * dt;
    t += dt;
  }
  return { t, v, h: Math.min(height, h) };
}

function makeSamples(height: number, g: number, scene: Scene): Sample[] {
  const interval = 0.5;
  const drag = scene === "air" ? 0.1 : 0;
  const maxTime = landingTime(height, g, drag);
  const samples: Sample[] = [];
  for (let t = 0; t < maxTime; t += interval) {
    const state = getDropAt(t, height, g, drag);
    samples.push({ t, v: state.v, h: state.h });
  }
  const last = getDropAt(maxTime, height, g, drag);
  samples.push({ t: maxTime, v: last.v, h: height });
  return samples;
}

function Graph({
  kind,
  samples,
  currentTime,
  height,
  g,
  drag,
}: {
  kind: "velocity" | "distance";
  samples: Sample[];
  currentTime: number;
  height: number;
  g: number;
  drag: number;
}) {
  const width = 320;
  const graphHeight = 132;
  const pad = { left: 36, right: 10, top: 10, bottom: 25 };
  const plotW = width - pad.left - pad.right;
  const plotH = graphHeight - pad.top - pad.bottom;
  const totalTime = landingTime(height, g, drag);
  const maxY = kind === "velocity" ? Math.max(...samples.map((sample) => sample.v), 0.1) : height;
  const yValue = (sample: Sample) => (kind === "velocity" ? sample.v : sample.h);
  const point = (sample: Sample) => ({
    x: pad.left + (sample.t / totalTime) * plotW,
    y: pad.top + plotH - (yValue(sample) / maxY) * plotH,
  });
  const line = samples.map(point).map(({ x, y }) => `${x},${y}`).join(" ");
  const current = point(getDropAt(Math.min(currentTime, totalTime), height, g, drag));
  const yTicks = [0, maxY / 2, maxY];

  return (
    <svg className="graph-svg" viewBox={`0 0 ${width} ${graphHeight}`} role="img" aria-label={kind === "velocity" ? "速度随时间变化图" : "位移随时间变化图"}>
      {yTicks.map((tick, index) => {
        const y = pad.top + plotH - (index / 2) * plotH;
        return (
          <g key={index}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} className="graph-grid" />
            <text x={pad.left - 7} y={y + 3} textAnchor="end" className="graph-label">{tick.toFixed(tick % 1 ? 1 : 0)}</text>
          </g>
        );
      })}
      <line x1={pad.left} y1={pad.top + plotH} x2={width - pad.right} y2={pad.top + plotH} className="graph-axis" />
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} className="graph-axis" />
      <polyline points={line} className="graph-line" />
      <line x1={current.x} y1={pad.top} x2={current.x} y2={pad.top + plotH} className="graph-cursor" />
      <circle cx={current.x} cy={current.y} r="4" className="graph-dot" />
      <text x={pad.left} y={graphHeight - 5} className="graph-label">0</text>
      <text x={width - pad.right} y={graphHeight - 5} textAnchor="end" className="graph-label">{totalTime.toFixed(1)} s</text>
      <text x={width - pad.right} y={graphHeight - 5} textAnchor="end" className="graph-axis-title">{kind === "velocity" ? "v (m/s)" : "h (m)"}</text>
    </svg>
  );
}

export default function Page() {
  const [height, setHeight] = useState(20);
  const [gravity, setGravity] = useState(9.8);
  const [scene, setScene] = useState<Scene>("ideal");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lastFrame = useRef<number | null>(null);
  const ballDrag = scene === "air" ? 0.1 : 0;
  const totalTime = landingTime(height, gravity, ballDrag);
  const ended = time >= totalTime;
  const mainState = getDropAt(time, height, gravity, ballDrag);
  const samples = useMemo(() => makeSamples(height, gravity, scene), [height, gravity, scene]);
  const timelineSamples = useMemo(() => {
    const steps = 5;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = (totalTime * i) / steps;
      const state = getDropAt(t, height, gravity, ballDrag);
      return { t, v: state.v, h: state.h };
    });
  }, [height, gravity, scene, totalTime, ballDrag]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const animate = (now: number) => {
      if (lastFrame.current === null) lastFrame.current = now;
      const delta = Math.min((now - lastFrame.current) / 1000, 0.05);
      lastFrame.current = now;
      setTime((current) => {
        const next = Math.min(totalTime, current + delta * 0.8);
        if (next >= totalTime) setPlaying(false);
        return next;
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [playing, totalTime]);

  useEffect(() => {
    if (!playing) lastFrame.current = null;
  }, [playing]);

  const reset = () => {
    setPlaying(false);
    setTime(0);
    lastFrame.current = null;
  };

  const setParameter = (kind: "height" | "gravity", value: number) => {
    if (kind === "height") setHeight(value);
    else setGravity(value);
    reset();
  };

  const releaseLabel = scene === "air" ? "小球" : scene === "vacuum" ? "小球 & 羽毛" : "小球";
  const dropTop = `${Math.min((mainState.h / height) * 100, 100)}%`;
  const secondDrop = scene === "air" ? getDropAt(time, height, gravity, 1.7) : mainState;
  const secondTop = `${Math.min((secondDrop.h / height) * 100, 100)}%`;

  return (
    <main className="lab-page">
      <header className="lab-header">
        <a className="brand" href="#" aria-label="自由落体实验室首页">
          <span className="brand-mark"><ArrowDownToLine size={18} strokeWidth={2.4} /></span>
          <span>物理实验室 <span className="brand-divider">/</span> 运动与力</span>
        </a>
        <div className="header-tag"><span className="status-dot" /> 互动课堂 · 高中物理</div>
      </header>

      <div className="lab-main">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span>实验 01</span><i /> 运动学 · 匀变速直线运动</div>
            <h1>自由落体</h1>
            <p>松开手，物体如何下落？调节重力、观察运动，亲自发现速度与位移的秘密。</p>
          </div>
          <div className="hero-formula" aria-label="自由落体公式">
            <span className="formula-caption">从静止开始</span>
            <div><i>v</i> = <i>gt</i></div>
            <div><i>h</i> = <span className="fraction"><b>1</b><b>2</b></span><i>gt</i><sup>2</sup></div>
            <span className="formula-foot">初速度 v₀ = 0</span>
          </div>
        </section>

        <section className="experiment-card" aria-label="自由落体交互实验">
          <div className="experiment-topline">
            <div className="section-heading"><span className="heading-icon"><Sparkles size={16} /></span><div><span className="eyebrow">INTERACTIVE SIMULATION</span><h2>开始你的实验</h2></div></div>
            <div className="ideal-pill"><span /> {scene === "air" ? "非理想模型" : "理想化模型"}</div>
          </div>

          <div className="experiment-layout">
            <div className="scene-column">
              <div className="scene-bar">
                <span className="scene-label"><span className="scene-live" /> 下落实验</span>
                <span className="scene-height-label">释放高度 <b>{height} m</b></span>
              </div>
              <div className={`fall-scene scene-${scene}`}>
                <div className="scene-sky">
                  <span className="cloud cloud-one" /><span className="cloud cloud-two" />
                  <div className="height-ruler"><span>0 m</span><i /><span>{height} m</span></div>
                  <div className="drop-track">
                    {scene === "vacuum" && <div className="falling-object feather-object" style={{ top: secondTop }} aria-label="羽毛"><Feather className="feather" size={21} strokeWidth={1.7} /></div>}
                    {scene === "air" && <div className="falling-object feather-object" style={{ top: secondTop }} aria-label="羽毛"><Feather className="feather" size={21} strokeWidth={1.7} /></div>}
                    <div className="release-mark"><span className="release-line" /><span>{releaseLabel}</span></div>
                    <div className="falling-object ball-object" style={{ top: dropTop }} aria-label="小球"><span /></div>
                    <div className="air-streak streak-one" /><div className="air-streak streak-two" />
                  </div>
                  <div className="ground"><span className="ground-line" /><span className="ground-grass">⌁　⌁　⌁　⌁　⌁　⌁　⌁　⌁</span></div>
                  <div className="scene-note">{scene === "air" ? "空气阻力向上" : "初速度为零 · 仅受重力"}</div>
                </div>
                <div className="scene-footer">
                  <div className="live-time"><Clock3 size={15} /><span>经过时间</span><strong>{time.toFixed(2)}<small> s</small></strong></div>
                  <div className="scene-actions">
                    <button className="play-button" onClick={() => ended ? (reset(), setPlaying(true)) : setPlaying((value) => !value)} aria-label={playing ? "暂停动画" : ended ? "重新播放" : "播放动画"}>
                      {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                      {playing ? "暂停" : ended ? "再看一次" : time > 0 ? "继续" : "释放物体"}
                    </button>
                    <button className="reset-button" onClick={reset} aria-label="复位"><RotateCcw size={16} /><span>复位</span></button>
                  </div>
                </div>
              </div>
              <div className="scrubber-row"><span>0.00 s</span><input aria-label="动画时间" type="range" min="0" max={totalTime} step="0.01" value={Math.min(time, totalTime)} onChange={(event) => { setTime(Number(event.target.value)); setPlaying(false); }} /><span>{totalTime.toFixed(2)} s</span></div>
            </div>

            <aside className="controls-column">
              <div className="control-title"><SlidersHorizontal size={15} /><h3>实验条件</h3></div>
              <label className="control-label" htmlFor="height-control"><span>下落高度</span><strong>{height}<small> m</small></strong></label>
              <input id="height-control" className="range-control" type="range" min="5" max="30" step="1" value={height} onChange={(event) => setParameter("height", Number(event.target.value))} />
              <div className="range-ends"><span>5 m</span><span>30 m</span></div>

              <div className="control-label gravity-label"><span>重力加速度 g</span><strong>{gravity.toFixed(1)}<small> m/s²</small></strong></div>
              <div className="gravity-options" role="group" aria-label="重力加速度">
                {[9.8, 10].map((value) => <button key={value} className={gravity === value ? "gravity-choice selected" : "gravity-choice"} onClick={() => setParameter("gravity", value)}>{value} <small>m/s²</small></button>)}
              </div>

              <div className="control-label scene-choice-title"><span>下落情境</span><CircleHelp size={14} aria-hidden="true" /></div>
              <div className="scene-options" role="group" aria-label="选择下落情境">
                {(Object.keys(SCENE_COPY) as Scene[]).map((key) => (
                  <button key={key} className={scene === key ? "scene-option selected" : "scene-option"} onClick={() => { setScene(key); reset(); }}>
                    <span className="radio-indicator" /><span className="scene-option-text"><b>{SCENE_COPY[key].label}</b><small>{SCENE_COPY[key].note}</small></span>
                  </button>
                ))}
              </div>
              <div className="model-tip"><Sparkles size={14} /><span>{scene === "air" ? "羽毛受阻力更明显，终端速度更小。" : "忽略空气阻力，是自由落体的理想条件。"}</span></div>
            </aside>
          </div>

          <div className="metrics-row">
            <div className="metric"><span className="metric-icon purple"><Clock3 size={16} /></span><div><span>运动时间</span><strong>{mainState.t.toFixed(2)}<small> s</small></strong></div></div>
            <div className="metric"><span className="metric-icon orange"><Gauge size={16} /></span><div><span>瞬时速度</span><strong>{mainState.v.toFixed(2)}<small> m/s</small></strong></div></div>
            <div className="metric"><span className="metric-icon green"><ArrowDown size={16} /></span><div><span>下落位移</span><strong>{mainState.h.toFixed(2)}<small> m</small></strong></div></div>
            <div className="metric-result"><span>落地所需时间</span><strong>{totalTime.toFixed(2)} <small>s</small></strong><span>从 h = ½gt² 推得</span></div>
          </div>
        </section>

        <section className="insight-grid">
          <article className="insight-card graphs-card">
            <div className="card-heading"><span className="card-kicker">运动规律</span><h2>用图像看清变化</h2><p>匀加速运动的速度—时间图像是一条斜直线；位移随时间平方增长。</p></div>
            <div className="graphs">
              <div className="graph-panel"><div className="graph-title"><span className="graph-key velocity-key" />速度 v—时间 t <small>{scene === "air" ? "受阻力影响" : "斜率 = g"}</small></div><Graph kind="velocity" samples={samples} currentTime={time} height={height} g={gravity} drag={ballDrag} /></div>
              <div className="graph-panel"><div className="graph-title"><span className="graph-key distance-key" />位移 h—时间 t <small>{scene === "air" ? "受阻力影响" : "曲线 · h ∝ t²"}</small></div><Graph kind="distance" samples={samples} currentTime={time} height={height} g={gravity} drag={ballDrag} /></div>
            </div>
          </article>
          <article className="insight-card table-card">
            <div className="card-heading"><span className="card-kicker">连续时刻观察</span><h2>每一刻，运动到哪里？</h2><p>等时间间隔记录速度与位移，注意相同时间内位移越来越大。</p></div>
            <div className="data-table-wrap">
              <table>
                <thead><tr><th>时间 t (s)</th><th>速度 v (m/s)</th><th>位移 h (m)</th></tr></thead>
                <tbody>{timelineSamples.map((sample, index) => <tr key={index} className={Math.abs(sample.t - time) < totalTime / 10 ? "current-row" : ""}><td>{sample.t.toFixed(2)}</td><td>{sample.v.toFixed(2)}</td><td>{sample.h.toFixed(2)}</td></tr>)}</tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="lesson-strip">
          <div className="lesson-icon"><ArrowRight size={18} /></div>
          <div className="lesson-copy"><span className="card-kicker">想一想</span><h2>为什么纸团比纸片落得快？</h2><p>改变形状会改变空气阻力。揉成纸团后，阻力减小，下落更快；在真空中，它们会同时落地。</p></div>
          <div className="lesson-equation"><span>自由落体的判断条件</span><b>v₀ = 0 <i>且</i> 阻力 ≈ 0</b></div>
        </section>

        <footer className="lab-footer"><span>地球表面通常取 g = 9.8 m/s²，粗略计算可取 10 m/s²。</span><span>物理 · 从观察到规律 <ArrowRight size={13} /></span></footer>
      </div>
    </main>
  );
}
