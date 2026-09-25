// 2D canvas "screens" that are uploaded as textures onto the 3D devices.
// If a real video clip is supplied it is drawn underneath the UI overlay.

const DISPLAY = '"Space Grotesk", Inter, system-ui, sans-serif';
const BODY = 'Inter, system-ui, sans-serif';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx, video, w, h) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const s = Math.max(w / vw, h / vh);
  const dw = vw * s, dh = vh * s;
  ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

const videoReady = (v) => v && v.readyState >= 2 && v.videoWidth > 0;
const ease = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

function heart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.35, x - s * 0.45, y - s, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.35, x, y + s * 0.35);
  ctx.fill();
}

// ---------------------------------------------------------------
// Vertical short-form phone screen
// ---------------------------------------------------------------
export class PhoneScreen {
  constructor({ hueA, hueB, lines, handle, caption, seed = 0 }) {
    this.w = 360; this.h = 740;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d');
    Object.assign(this, { hueA, hueB, lines, handle, caption, seed });
    this.video = null;
  }

  draw(t) {
    const { ctx, w, h } = this;
    const tt = t + this.seed;

    if (videoReady(this.video)) {
      drawCover(ctx, this.video, w, h);
    } else {
      const g = ctx.createLinearGradient(0, 0, w * 0.6, h);
      g.addColorStop(0, `hsl(${this.hueA + Math.sin(tt * 0.3) * 18}, 78%, 52%)`);
      g.addColorStop(1, `hsl(${this.hueB}, 70%, 16%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 3; i++) {
        const cx = w * (0.5 + Math.sin(tt * (0.4 + i * 0.13) + i * 2) * 0.45);
        const cy = h * (0.35 + Math.cos(tt * (0.3 + i * 0.1) + i) * 0.3);
        const r = 140 + i * 40;
        const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        rg.addColorStop(0, `hsla(${this.hueA + 40 * i}, 90%, 70%, 0.45)`);
        rg.addColorStop(1, 'hsla(0,0%,100%,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      }

      // Big hook text, one line popping in at a time
      const cycle = 4.5;
      const local = (tt % cycle) / cycle;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      this.lines.forEach((line, i) => {
        const appear = ease((local - i * 0.12) * 5);
        if (appear <= 0) return;
        let size = i === 1 ? 64 : 44;
        ctx.font = `700 ${size}px ${DISPLAY}`;
        const maxW = w - 90;
        const tw = ctx.measureText(line).width;
        if (tw > maxW) { size = Math.floor(size * maxW / tw); ctx.font = `700 ${size}px ${DISPLAY}`; }
        const y = h * 0.34 + i * 70 + (1 - appear) * 30;
        ctx.globalAlpha = appear;
        ctx.lineWidth = 8;
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.strokeText(line, w / 2, y);
        ctx.fillStyle = i === 1 ? '#ffe14d' : '#fff';
        ctx.fillText(line, w / 2, y);
      });
      ctx.globalAlpha = 1;
    }

    // Top tabs
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, w, 70);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 17px ${BODY}`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('Following', w / 2 - 55, 44);
    ctx.font = `700 17px ${BODY}`;
    ctx.fillStyle = '#fff';
    ctx.fillText('For You', w / 2 + 48, 44);
    ctx.fillRect(w / 2 + 34, 60, 28, 3);

    // Right action column
    const x = w - 38;
    let y = h * 0.5;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `hsl(${this.hueA}, 80%, 55%)`;
    ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff2d55';
    ctx.beginPath(); ctx.arc(x, y + 22, 8, 0, Math.PI * 2); ctx.fill();

    const pulse = 1 + Math.max(0, Math.sin(tt * 3)) * 0.12;
    ctx.fillStyle = Math.sin(tt * 1.3) > 0 ? '#ff2d55' : '#fff';
    y += 78; heart(ctx, x, y, 20 * pulse);
    ctx.fillStyle = '#fff';
    ctx.font = `600 13px ${BODY}`;
    ctx.fillText('48.2K', x, y + 30);
    y += 72;
    rr(ctx, x - 17, y - 16, 34, 28, 12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 6, y + 10); ctx.lineTo(x - 12, y + 20); ctx.lineTo(x + 2, y + 10); ctx.fill();
    ctx.fillText('1,204', x, y + 34);
    y += 72;
    ctx.beginPath(); ctx.moveTo(x - 14, y + 12); ctx.lineTo(x + 14, y); ctx.lineTo(x - 14, y - 12); ctx.lineTo(x - 8, y); ctx.closePath(); ctx.fill();
    ctx.fillText('Share', x, y + 30);

    // Bottom caption
    const bg = ctx.createLinearGradient(0, h - 190, 0, h);
    bg.addColorStop(0, 'rgba(0,0,0,0)');
    bg.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, h - 190, w, 190);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = `700 18px ${BODY}`;
    ctx.fillText(this.handle, 18, h - 96);
    ctx.font = `400 15px ${BODY}`;
    ctx.fillText(this.caption, 18, h - 70);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('♪  original sound', 18, h - 44);

    // Progress
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0, h - 6, w, 6);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, h - 6, ((tt * 0.12) % 1) * w, 6);
  }
}

// ---------------------------------------------------------------
// 16:9 monitor: a video player in the hero, the production
// pipeline (script → voice → edit → thumbnail → publish) later.
// ---------------------------------------------------------------
const SCRIPT_LINES = [
  ['HOOK', 'In 1971, one decision changed everything.'],
  ['0:06', 'But nobody talks about what came next.'],
  ['0:14', 'B-roll: archive footage, slow push-in'],
  ['0:22', 'Part 1: the problem nobody saw coming'],
  ['0:41', 'On-screen: animated map + date stamp'],
  ['1:05', 'Part 2: the turning point'],
  ['1:32', 'Retention beat: "and that is where it broke"'],
];

export const STAGES = ['Script', 'Voiceover', 'Edit', 'Thumbnail', 'Publish'];

export class MonitorScreen {
  constructor() {
    this.w = 1024; this.h = 576;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d');
    this.video = null;
  }

  draw(t, mode, stage = 0, stageT = 0) {
    if (mode === 'pipeline') this.drawStage(t, stage, stageT);
    else this.drawPlayer(t);
  }

  landscape(t, x = 0, y = 0, w = this.w, h = this.h) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const sky = ctx.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, '#1b1045');
    sky.addColorStop(0.55, '#7c3a8f');
    sky.addColorStop(1, '#ff8a5c');
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 40; i++) {
      const sx = x + ((i * 97.13) % w), sy = y + ((i * 53.7) % (h * 0.45));
      ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t + i));
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
    const sun = ctx.createRadialGradient(x + w * 0.62, y + h * 0.62, 0, x + w * 0.62, y + h * 0.62, h * 0.35);
    sun.addColorStop(0, 'rgba(255,220,150,1)');
    sun.addColorStop(0.3, 'rgba(255,170,110,0.9)');
    sun.addColorStop(1, 'rgba(255,120,100,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(x, y, w, h);
    const layers = [['#4a1f6b', 0.62, 0.05, 30], ['#2c1452', 0.72, 0.1, 45], ['#140a2e', 0.84, 0.2, 60]];
    layers.forEach(([c, base, speed, amp], i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      for (let px = 0; px <= w; px += 16) {
        const k = (px / w) * Math.PI * (2 + i) + t * speed * 3;
        ctx.lineTo(x + px, y + h * base + Math.sin(k) * amp * (h / 576) + Math.sin(k * 2.3) * amp * 0.3 * (h / 576));
      }
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }

  drawPlayer(t) {
    const { ctx, w, h } = this;
    if (videoReady(this.video)) drawCover(ctx, this.video, w, h);
    else this.landscape(t);

    const top = ctx.createLinearGradient(0, 0, 0, 130);
    top.addColorStop(0, 'rgba(0,0,0,0.6)'); top.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = top; ctx.fillRect(0, 0, w, 130);
    ctx.fillStyle = '#7c5cff';
    ctx.beginPath(); ctx.arc(52, 50, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `700 22px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', 52, 51);
    ctx.textAlign = 'left';
    ctx.font = `600 24px ${BODY}`;
    ctx.fillText('The Decision That Changed Everything', 90, 42);
    ctx.font = `400 17px ${BODY}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('Documentary · Episode 12', 90, 68);

    const bot = ctx.createLinearGradient(0, h - 120, 0, h);
    bot.addColorStop(0, 'rgba(0,0,0,0)'); bot.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = bot; ctx.fillRect(0, h - 120, w, 120);
    const p = (t * 0.025) % 1;
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(24, h - 62, w - 48, 6);
    ctx.fillStyle = '#ff3b3b'; ctx.fillRect(24, h - 62, (w - 48) * p, 6);
    ctx.beginPath(); ctx.arc(24 + (w - 48) * p, h - 59, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(30, h - 38, 7, 24); ctx.fillRect(44, h - 38, 7, 24);
    ctx.font = `500 18px ${BODY}`;
    const secs = Math.floor(p * 768);
    ctx.fillText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} / 12:48`, 76, h - 24);
    ctx.textAlign = 'right';
    ctx.fillText('CC   HD   ⛶', w - 28, h - 24);
  }

  chrome(title, index) {
    const { ctx, w, h } = this;
    ctx.fillStyle = '#0d0d1a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#16162b'; ctx.fillRect(0, 0, w, 56);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(30 + i * 24, 28, 7, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `600 19px ${BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${String(index + 1).padStart(2, '0')} · ${title}`, w / 2, 29);
    ctx.textAlign = 'left';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i <= index ? '#7c5cff' : 'rgba(255,255,255,0.12)';
      rr(ctx, w - 190 + i * 34, 23, 26, 10, 5); ctx.fill();
    }
  }

  drawStage(t, stage, st) {
    const { ctx, w, h } = this;
    this.chrome(STAGES[stage], stage);

    if (stage === 0) {
      ctx.font = `700 30px ${DISPLAY}`; ctx.fillStyle = '#fff';
      ctx.fillText('Episode 12 — Script v3', 48, 104);
      const chars = Math.floor(ease(st * 1.1) * SCRIPT_LINES.reduce((a, l) => a + l[1].length, 0));
      let left = chars;
      SCRIPT_LINES.forEach(([tag, text], i) => {
        const y = 160 + i * 52;
        const shown = text.slice(0, Math.max(0, left));
        left -= text.length;
        ctx.fillStyle = tag === 'HOOK' ? '#22d3ee' : 'rgba(255,255,255,0.4)';
        ctx.font = `600 16px ${BODY}`;
        ctx.fillText(tag, 48, y);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = `400 22px ${BODY}`;
        ctx.fillText(shown, 120, y);
        if (left < 0 && left > -text.length - 1 && Math.sin(t * 8) > 0) {
          ctx.fillRect(120 + ctx.measureText(shown).width + 3, y - 12, 2, 24);
        }
      });
    } else if (stage === 1) {
      ctx.fillStyle = '#ff3b3b';
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5);
      ctx.beginPath(); ctx.arc(60, 104, 10, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff'; ctx.font = `700 26px ${DISPLAY}`;
      ctx.fillText('REC  Voiceover · take 3', 82, 106);
      const n = 96, bw = (w - 96) / n;
      for (let i = 0; i < n; i++) {
        const progress = i / n;
        const active = progress < ease(st * 1.2);
        const a = Math.abs(Math.sin(i * 0.7 + t * 6) * Math.sin(i * 0.23 + t * 2)) * 0.9 + 0.1;
        const bh = a * 220;
        ctx.fillStyle = active ? `hsl(${260 - progress * 70}, 90%, 65%)` : 'rgba(255,255,255,0.12)';
        rr(ctx, 48 + i * bw, 320 - bh / 2, bw - 3, bh, 3); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = `500 18px ${BODY}`;
      ctx.fillText('Pace: natural · Noise removed · Levels −14 LUFS', 48, h - 50);
    } else if (stage === 2) {
      this.landscape(t, 48, 76, w * 0.58, h * 0.46);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      rr(ctx, w * 0.58 + 72, 76, w - (w * 0.58 + 120), h * 0.46, 10); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `500 17px ${BODY}`;
      ['Color grade', 'Motion graphics', 'Captions', 'Sound design'].forEach((s, i) => {
        const on = st * 4.5 > i;
        ctx.fillStyle = on ? '#22d3ee' : 'rgba(255,255,255,0.3)';
        ctx.fillText((on ? '✓  ' : '○  ') + s, w * 0.58 + 92, 118 + i * 44);
      });
      const tracks = [['#7c5cff', 'V2'], ['#22d3ee', 'V1'], ['#ff4d8d', 'A1'], ['#f59e0b', 'A2']];
      tracks.forEach(([c, label], r) => {
        const y = 364 + r * 44;
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = `600 14px ${BODY}`;
        ctx.fillText(label, 48, y + 20);
        let x = 90;
        for (let k = 0; k < 7; k++) {
          const cw = 60 + ((k * 37 + r * 23) % 90);
          if (x + cw > w - 40) break;
          const vis = ease(st * 1.6 - (x / w) * 0.8);
          ctx.globalAlpha = vis;
          ctx.fillStyle = c;
          rr(ctx, x, y, cw - 6, 30, 6); ctx.fill();
          x += cw;
        }
        ctx.globalAlpha = 1;
      });
      const px = 90 + ((st * 1.3) % 1) * (w - 140);
      ctx.fillStyle = '#fff'; ctx.fillRect(px, 352, 2, 190);
      ctx.beginPath(); ctx.moveTo(px - 8, 350); ctx.lineTo(px + 10, 350); ctx.lineTo(px + 1, 362); ctx.fill();
    } else if (stage === 3) {
      const tw = 560, th = 315, tx = 48, ty = 100;
      this.landscape(t * 0.3, tx, ty, tw, th);
      ctx.save();
      ctx.beginPath(); ctx.rect(tx, ty, tw, th); ctx.clip();
      const k = ease(st * 1.4);
      ctx.font = `800 64px ${DISPLAY}`;
      ctx.lineWidth = 10; ctx.strokeStyle = '#000';
      ctx.globalAlpha = k;
      ctx.strokeText('THE $1 MISTAKE', tx + 26, ty + 90 + (1 - k) * 30);
      ctx.fillStyle = '#ffe14d';
      ctx.fillText('THE $1 MISTAKE', tx + 26, ty + 90 + (1 - k) * 30);
      const k2 = ease(st * 1.4 - 0.4);
      ctx.globalAlpha = k2;
      ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(tx + 420, ty + 220, 60 * k2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx + 230, ty + 250); ctx.lineTo(tx + 340, ty + 225); ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff'; ctx.font = `700 24px ${DISPLAY}`;
      ctx.fillText('A/B test', 660, 118);
      [['Version A', 0.46], ['Version B', 0.72]].forEach(([label, v], i) => {
        const y = 170 + i * 90;
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `500 18px ${BODY}`;
        ctx.fillText(label, 660, y);
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, 660, y + 16, 300, 18, 9); ctx.fill();
        ctx.fillStyle = i ? '#22d3ee' : '#7c5cff';
        rr(ctx, 660, y + 16, 300 * v * ease(st * 1.5), 18, 9); ctx.fill();
      });
      if (st > 0.6) {
        ctx.fillStyle = '#28c840'; ctx.font = `600 18px ${BODY}`;
        ctx.fillText('✓ Winner: Version B', 660, 380);
      }
    } else {
      ctx.fillStyle = '#fff'; ctx.font = `700 30px ${DISPLAY}`;
      ctx.fillText('Publishing', 48, 110);
      const up = ease(st * 1.6);
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, 48, 140, w - 96, 22, 11); ctx.fill();
      const g = ctx.createLinearGradient(48, 0, w - 48, 0);
      g.addColorStop(0, '#7c5cff'); g.addColorStop(1, '#22d3ee');
      ctx.fillStyle = g; rr(ctx, 48, 140, Math.max(22, (w - 96) * up), 22, 11); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `500 17px ${BODY}`;
      ctx.fillText(up < 1 ? `Uploading… ${Math.round(up * 100)}%` : 'Upload complete', 48, 192);
      const items = ['SEO title & description', 'Tags & chapters', 'Custom thumbnail', 'Shorts cut → TikTok & Reels', 'Scheduled: Friday 6:00 PM'];
      items.forEach((s, i) => {
        const on = st * 1.8 > 0.35 + i * 0.22;
        const y = 250 + i * 56;
        ctx.fillStyle = on ? 'rgba(40,200,64,0.15)' : 'rgba(255,255,255,0.05)';
        rr(ctx, 48, y - 24, w - 96, 44, 10); ctx.fill();
        ctx.fillStyle = on ? '#28c840' : 'rgba(255,255,255,0.3)';
        ctx.font = `700 20px ${BODY}`;
        ctx.fillText(on ? '✓' : '○', 68, y + 6);
        ctx.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.4)';
        ctx.font = `500 19px ${BODY}`;
        ctx.fillText(s, 104, y + 6);
      });
    }
  }
}
