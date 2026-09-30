// Stylized raptor motion. Angles are in radians; gameplay position is unchanged.
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
function stroke(phase) {
  // A decisive power stroke followed by a slower recovery.
  const down = phase < 0.42;
  const t = down ? phase / 0.42 : (phase - 0.42) / 0.58;
  const ease = (1 - Math.cos(t * Math.PI)) * 0.5;
  return down ? 0.52 - ease * 0.98 : -0.46 + ease * 0.98;
}

export class FlightMotion {
  constructor() { this.reset(); }

  reset() {
    this.wasDiving=false;this.recovery=0;
    this.mode = 'flap'; this.phase = 0.72; this.beats = 0;
    this.glideTime = 0; this.elapsed = 0; this.weight = 0;
    this.climb = 0; this.turn = 0; this.boost = 0; this.dive = 0; this.flare = 0;
    this.pose = { leftLift: 0.10, rightLift: 0.10, wristLift: 0.06,
      fold: 0, sweep: 0, twist: 0, tailYaw: 0, tailPitch: 0.04, tailSpread: 1,
      bob: 0, downstroke: 0, mode: 'flap' };
  }

  // Grab: wings brake high and forward with a fanned tail, then a few powerful beats.
  grab() { this.flare = 1; this.mode = 'flap'; this.beats = 0; this.phase = 0.42; }

  update(dt, { climb = 0, turn = 0, boosting = false, diving = false, descent = 0, brace = 0 } = {}) {
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
    this.elapsed += dt;
    this.climb = damp(this.climb, clamp(climb / 14, -1, 1), 4, dt);
    this.turn = damp(this.turn, clamp(turn, -1, 1), 5, dt);
    this.boost = damp(this.boost, boosting ? 1 : 0, 5, dt);
    // Stoop: wings tuck back, no flapping.
    if(this.wasDiving&&!diving){this.recovery=Math.max(this.recovery,this.dive);this.mode='flap';this.beats=0;this.phase=.72;}
    this.wasDiving=diving;
    this.recovery=Math.max(0,this.recovery-dt*.7);
    const depth=clamp(descent,0,1);
    const tuck=diving ? .28+.72*depth : depth*.22;
    this.dive = damp(this.dive, tuck*(1-this.flare), diving?4:7, dt);
    if (diving) { this.mode = 'glide'; this.glideTime = 0; }
    this.flare = Math.max(0, this.flare - dt * 1.4);
    // first ~0.3 s after the grab; brace — the feet-first strike just before it
    const brake = Math.max(clamp((this.flare - 0.6) / 0.4, 0, 1), this.recovery * .38, brace * .9);
    const effort = Math.max(0, this.climb, this.flare, this.recovery*.8);
    if (this.mode === 'glide') {
      this.glideTime += dt;
      if ((!diving || this.flare>0) && (this.glideTime >= 4.4 || effort > 0.18 || boosting)) {
        this.mode = 'flap'; this.beats = 0; this.phase = 0.72;
      }
    }
    if (this.mode === 'flap') {
      this.phase += dt * (1.2 + effort * 0.45 + this.boost * 0.45 + this.flare * 1.2) * (1 - brake);
      if (this.phase >= 1) {
        this.phase %= 1; this.beats++;
        if (this.beats >= 3 && effort < 0.14 && !boosting) {
          this.mode = 'glide'; this.glideTime = 0;
        }
      }
    }
    this.weight = damp(this.weight, this.mode === 'flap' && (!diving || this.flare>0) ? 1 : 0, 5, dt);
    const up = this.phase > 0.42 ? Math.sin((this.phase - 0.42) / 0.58 * Math.PI) : 0;
    const lift = stroke(this.phase);
    const lag = stroke((this.phase + 0.89) % 1);
    const glideLift = 0.10 + Math.sin(this.elapsed * 1.8) * 0.013;
    let targetLift = (glideLift * (1 - this.weight) + lift * this.weight) * (1 - this.dive) + 0.32 * this.dive;
    targetLift = targetLift * (1 - brake) + 0.55 * brake;
    const p = this.pose;
    p.leftLift = damp(p.leftLift, targetLift + this.turn * 0.045, 16, dt);
    p.rightLift = damp(p.rightLift, targetLift - this.turn * 0.045, 16, dt);
    p.wristLift = damp(p.wristLift, 0.055 + (lag - lift) * this.weight * 0.38, 12, dt);
    p.fold = damp(p.fold, up * this.weight * 0.26 + this.boost * 0.12 + this.dive * 1.10, 12, dt);
    p.sweep = damp(p.sweep, this.dive * 0.55 - brake * 0.25, 8, dt);
    p.twist = damp(p.twist, up * this.weight * 0.10 - this.dive*.12 + brake*.10, 10, dt);
    p.tailYaw = damp(p.tailYaw, -this.turn * 0.20, 6, dt);
    p.tailPitch = damp(p.tailPitch, 0.04 + this.climb * 0.11 - this.boost * 0.05 + brake * 0.25, 5, dt);
    p.tailSpread = damp(p.tailSpread, 1 + Math.abs(this.turn) * 0.24 + effort * 0.14 - this.boost * 0.18 - this.dive * 0.4 + brake * 0.5, 5, dt);
    p.bob = Math.sin(this.phase * Math.PI * 2 - 0.6) * this.weight * 0.09 * (1 - this.dive);
    p.downstroke = this.phase < 0.42 ? Math.sin(this.phase / 0.42 * Math.PI) * this.weight : 0;
    p.downstroke *= 1-this.dive;
    p.diveAmount=this.dive;p.recovery=this.recovery;
    p.mode = this.mode;
    return p;
  }
}
