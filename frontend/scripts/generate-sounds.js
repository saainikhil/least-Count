// import fs from 'node:fs';
// import path from 'node:path';
// import { fileURLToPath } from 'node:url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const outputDir = path.resolve(__dirname, '../public/sounds');

// if (!fs.existsSync(outputDir)) {
//   fs.mkdirSync(outputDir, { recursive: true });
// }

// const SR = 44100;

// function writeWav(filename, samples, sampleRate = SR) {
//   const numChannels = 1;
//   const bitsPerSample = 16;
//   const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
//   const blockAlign = numChannels * (bitsPerSample / 8);
//   const dataSize = samples.length * (bitsPerSample / 8);
//   const buffer = Buffer.alloc(44 + dataSize);

//   buffer.write('RIFF', 0);
//   buffer.writeUInt32LE(36 + dataSize, 4);
//   buffer.write('WAVE', 8);

//   buffer.write('fmt ', 12);
//   buffer.writeUInt32LE(16, 16);
//   buffer.writeUInt16LE(1, 20);
//   buffer.writeUInt16LE(numChannels, 22);
//   buffer.writeUInt32LE(sampleRate, 24);
//   buffer.writeUInt32LE(byteRate, 28);
//   buffer.writeUInt16LE(blockAlign, 32);
//   buffer.writeUInt16LE(bitsPerSample, 34);

//   buffer.write('data', 36);
//   buffer.writeUInt32LE(dataSize, 40);

//   for (let i = 0; i < samples.length; i++) {
//     const s = Math.max(-1, Math.min(1, samples[i]));
//     const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
//     buffer.writeInt16LE(Math.round(val), 44 + i * 2);
//   }

//   const fullPath = path.join(outputDir, filename);
//   fs.writeFileSync(fullPath, buffer);
//   console.log(`Generated: ${filename} (${(buffer.length / 1024).toFixed(1)} KB, ${(samples.length / sampleRate).toFixed(2)}s)`);
// }

// // Simple deterministic PRNG for reproducible sound textures
// function createNoiseGen(seed = 12345) {
//   let s = seed;
//   return () => {
//     s = (s * 1664525 + 1013904223) % 4294967296;
//     return (s / 2147483648) - 1;
//   };
// }

// // Biquad bandpass filter
// class BandpassFilter {
//   constructor(freq, q, sampleRate = SR) {
//     const omega = 2 * Math.PI * freq / sampleRate;
//     const alpha = Math.sin(omega) / (2 * q);
//     const b0 = alpha;
//     const b1 = 0;
//     const b2 = -alpha;
//     const a0 = 1 + alpha;
//     const a1 = -2 * Math.cos(omega);
//     const a2 = 1 - alpha;

//     this.b0 = b0 / a0;
//     this.b1 = b1 / a0;
//     this.b2 = b2 / a0;
//     this.a1 = a1 / a0;
//     this.a2 = a2 / a0;

//     this.x1 = 0;
//     this.x2 = 0;
//     this.y1 = 0;
//     this.y2 = 0;
//   }

//   process(x) {
//     const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
//     this.x2 = this.x1;
//     this.x1 = x;
//     this.y2 = this.y1;
//     this.y1 = y;
//     return y;
//   }
// }

// // Biquad lowpass filter
// class LowpassFilter {
//   constructor(freq, q = 0.707, sampleRate = SR) {
//     const omega = 2 * Math.PI * freq / sampleRate;
//     const alpha = Math.sin(omega) / (2 * q);
//     const cosw = Math.cos(omega);
//     const b0 = (1 - cosw) / 2;
//     const b1 = 1 - cosw;
//     const b2 = (1 - cosw) / 2;
//     const a0 = 1 + alpha;
//     const a1 = -2 * cosw;
//     const a2 = 1 - alpha;

//     this.b0 = b0 / a0;
//     this.b1 = b1 / a0;
//     this.b2 = b2 / a0;
//     this.a1 = a1 / a0;
//     this.a2 = a2 / a0;

//     this.x1 = 0;
//     this.x2 = 0;
//     this.y1 = 0;
//     this.y2 = 0;
//   }

//   process(x) {
//     const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
//     this.x2 = this.x1;
//     this.x1 = x;
//     this.y2 = this.y1;
//     this.y1 = y;
//     return y;
//   }
// }

// // 1. CARD SELECT: Subtle, quick card handling/movement sound (~75ms)
// function generateCardSelect() {
//   const duration = 0.08;
//   const numSamples = Math.floor(duration * SR);
//   const samples = new Float32Array(numSamples);
//   const noise = createNoiseGen(42);
//   const bp = new BandpassFilter(2600, 1.8);
//   const lp = new LowpassFilter(5000, 0.8);

//   for (let i = 0; i < numSamples; i++) {
//     const t = i / SR;
//     // Fast attack (3ms), exponential decay
//     const env = t < 0.003
//       ? t / 0.003
//       : Math.exp(-(t - 0.003) * 65);

//     // Friction paper texture
//     const n = noise();
//     const filteredNoise = lp.process(bp.process(n));

//     // Subtle cardboard body click
//     const bodySine = Math.sin(2 * Math.PI * 340 * t) * Math.exp(-t * 120);

//     samples[i] = (filteredNoise * 0.7 + bodySine * 0.3) * env * 0.45;
//   }
//   return samples;
// }

// // 2. CARD DROP / DISCARD: Realistic card slap / placement on table (~160ms)
// function generateCardDrop() {
//   const duration = 0.16;
//   const numSamples = Math.floor(duration * SR);
//   const samples = new Float32Array(numSamples);
//   const noise = createNoiseGen(99);
//   const snapBp = new BandpassFilter(3200, 1.6);
//   const paperBp = new BandpassFilter(1600, 2.0);

//   for (let i = 0; i < numSamples; i++) {
//     const t = i / SR;

//     // 1. Initial sharp card slap transient (first 6ms)
//     const snapEnv = t < 0.002 ? t / 0.002 : Math.exp(-(t - 0.002) * 110);
//     const snapSound = snapBp.process(noise()) * snapEnv;

//     // 2. Table impact thump (low frequency resonance dropping 160Hz -> 80Hz)
//     const freq = 160 * Math.exp(-t * 25) + 65;
//     const thumpEnv = t < 0.004 ? t / 0.004 : Math.exp(-(t - 0.004) * 45);
//     const tableThump = Math.sin(2 * Math.PI * freq * t) * thumpEnv;

//     // 3. Paper flutter/air cushion settling
//     const paperEnv = t < 0.006 ? t / 0.006 : Math.exp(-(t - 0.006) * 35);
//     const paperFlutter = paperBp.process(noise()) * paperEnv;

//     samples[i] = (snapSound * 0.45 + tableThump * 0.35 + paperFlutter * 0.25) * 0.65;
//   }
//   return samples;
// }

// // 3. CARD DRAW: Card sliding/being drawn off the deck (~220ms)
// function generateCardDraw() {
//   const duration = 0.22;
//   const numSamples = Math.floor(duration * SR);
//   const samples = new Float32Array(numSamples);
//   const noise = createNoiseGen(777);
//   const bp1 = new BandpassFilter(1800, 2.2);
//   const bp2 = new BandpassFilter(2800, 2.0);
//   const lp = new LowpassFilter(4500, 0.7);

//   for (let i = 0; i < numSamples; i++) {
//     const t = i / SR;

//     // Smooth sliding envelope: swell (25ms), sustained slide, soft lift at end
//     let env = 0;
//     if (t < 0.025) {
//       env = Math.sin((t / 0.025) * (Math.PI / 2));
//     } else if (t < 0.16) {
//       env = 1.0 - (t - 0.025) * 1.8;
//     } else {
//       env = Math.max(0, 0.75 * Math.exp(-(t - 0.16) * 40));
//     }

//     // Sliding pitch sweep (paper edge sliding faster then lifting)
//     const n = noise();
//     const slide = bp1.process(n) * 0.6 + bp2.process(n) * 0.4;
//     const filtered = lp.process(slide);

//     // Subtle paper edge hiss
//     const whisper = n * 0.08 * env;

//     samples[i] = (filtered + whisper) * env * 0.55;
//   }
//   return samples;
// }

// // 4. CARD PICK: Picking up top discard card (~150ms)
// function generateCardPick() {
//   const duration = 0.15;
//   const numSamples = Math.floor(duration * SR);
//   const samples = new Float32Array(numSamples);
//   const noise = createNoiseGen(314);
//   const snapBp = new BandpassFilter(2400, 2.5);
//   const rustleBp = new BandpassFilter(1500, 1.8);

//   for (let i = 0; i < numSamples; i++) {
//     const t = i / SR;

//     // Light lift snap at start, then soft paper release
//     const snapEnv = t < 0.002 ? t / 0.002 : Math.exp(-(t - 0.002) * 80);
//     const snap = snapBp.process(noise()) * snapEnv;

//     const rustleEnv = t < 0.015 ? t / 0.015 : Math.exp(-(t - 0.015) * 35);
//     const rustle = rustleBp.process(noise()) * rustleEnv;

//     const liftTone = Math.sin(2 * Math.PI * (280 + t * 400) * t) * Math.exp(-t * 60) * 0.2;

//     samples[i] = (snap * 0.45 + rustle * 0.4 + liftTone * 0.15) * 0.5;
//   }
//   return samples;
// }

// // 5. CARD SHUFFLE: Realistic deck riffle shuffle and cascade (~1.35s)
// function generateCardShuffle() {
//   const duration = 1.35;
//   const numSamples = Math.floor(duration * SR);
//   const samples = new Float32Array(numSamples);
//   const noise = createNoiseGen(888);

//   // Generate a sequence of card flick impulses (riffle)
//   // Riffle lasts from t = 0.05 to t = 0.85
//   const flickTimes = [];
//   let curT = 0.06;
//   const numFlicks = 28;
//   for (let f = 0; f < numFlicks; f++) {
//     flickTimes.push(curT);
//     // Spacing between cards accelerates slightly like a real thumb riffle
//     const interval = 0.032 - (f / numFlicks) * 0.012 + (noise() * 0.003);
//     curT += Math.max(0.014, interval);
//   }

//   // Cascade / waterfall / squaring deck from t = 0.88 to 1.25
//   const cascadeTimes = [];
//   curT = 0.88;
//   for (let c = 0; c < 16; c++) {
//     cascadeTimes.push(curT);
//     curT += 0.016 + (noise() * 0.004);
//   }

//   // Pre-generate individual card snap pulses
//   const snapBP = new BandpassFilter(2800, 2.0);
//   const bodyLP = new LowpassFilter(600, 0.7);

//   for (let i = 0; i < numSamples; i++) {
//     const t = i / SR;
//     let sample = 0;

//     // Riffle impulses
//     for (let f = 0; f < flickTimes.length; f++) {
//       const ft = flickTimes[f];
//       const dt = t - ft;
//       if (dt >= 0 && dt < 0.02) {
//         const flickEnv = dt < 0.001 ? dt / 0.001 : Math.exp(-(dt - 0.001) * 220);
//         const flickFreq = 2200 + (f % 5) * 250;
//         const flickTone = Math.sin(2 * Math.PI * flickFreq * dt);
//         sample += (flickTone * 0.4 + noise() * 0.6) * flickEnv * 0.45;
//       }
//     }

//     // Cascade / bridge
//     for (let c = 0; c < cascadeTimes.length; c++) {
//       const ct = cascadeTimes[c];
//       const dt = t - ct;
//       if (dt >= 0 && dt < 0.025) {
//         const cascEnv = dt < 0.002 ? dt / 0.002 : Math.exp(-(dt - 0.002) * 160);
//         sample += (noise() * 0.7 + Math.sin(2 * Math.PI * 1800 * dt) * 0.3) * cascEnv * 0.35;
//       }
//     }

//     // Final table tap / square deck at 1.22s
//     const tapDt = t - 1.22;
//     if (tapDt >= 0 && tapDt < 0.08) {
//       const tapEnv = tapDt < 0.003 ? tapDt / 0.003 : Math.exp(-(tapDt - 0.003) * 60);
//       const tapThump = Math.sin(2 * Math.PI * 140 * tapDt);
//       sample += (tapThump * 0.4 + noise() * 0.4) * tapEnv * 0.5;
//     }

//     // Continuous subtle background paper rustle during riffle
//     if (t > 0.05 && t < 0.85) {
//       const bgEnv = Math.sin(((t - 0.05) / 0.8) * Math.PI);
//       sample += snapBP.process(noise()) * 0.08 * bgEnv;
//     }

//     samples[i] = sample * 0.7;
//   }
//   return samples;
// }

// // 6. WIN JINGLE: Pleasant, warm celebratory victory chime (~1.4s)
// // Notes: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
// function generateWinJingle() {
//   const duration = 1.45;
//   const numSamples = Math.floor(duration * SR);
//   const samples = new Float32Array(numSamples);

//   const notes = [
//     { freq: 523.25, time: 0.00, dur: 0.6 },
//     { freq: 659.25, time: 0.14, dur: 0.6 },
//     { freq: 783.99, time: 0.28, dur: 0.7 },
//     { freq: 1046.50, time: 0.44, dur: 0.95 },
//   ];

//   for (let i = 0; i < numSamples; i++) {
//     const t = i / SR;
//     let s = 0;

//     for (const note of notes) {
//       const dt = t - note.time;
//       if (dt >= 0 && dt < note.dur) {
//         // Smooth soft chime attack (10ms) and warm exponential decay
//         const env = dt < 0.012
//           ? dt / 0.012
//           : Math.exp(-(dt - 0.012) * (3.5 / note.dur));

//         // Warm chime harmonics (fundamental + 2nd harmonic + 3rd harmonic + 4th shimmer)
//         const f = note.freq;
//         const vibrato = 1 + 0.003 * Math.sin(2 * Math.PI * 5 * dt);
//         const tone =
//           Math.sin(2 * Math.PI * f * vibrato * dt) * 0.6 +
//           Math.sin(2 * Math.PI * (f * 2) * dt) * 0.25 +
//           Math.sin(2 * Math.PI * (f * 3) * dt) * 0.1 +
//           Math.sin(2 * Math.PI * (f * 4) * dt) * 0.05;

//         // Soft mallet tap transient
//         const tap = Math.sin(2 * Math.PI * (f * 5) * dt) * Math.exp(-dt * 80) * 0.15;

//         s += (tone + tap) * env * 0.28;
//       }
//     }

//     samples[i] = s * 0.75;
//   }
//   return samples;
// }

// // 7. LOSE TONE: Short, gentle losing tone (~1.0s)
// // Gentle descending mellow phrase: E4 (329.63) -> D4 (293.66) -> A3 (220.00)
// function generateLoseTone() {
//   const duration = 1.05;
//   const numSamples = Math.floor(duration * SR);
//   const samples = new Float32Array(numSamples);

//   const notes = [
//     { freq: 329.63, time: 0.00, dur: 0.35 },
//     { freq: 293.66, time: 0.24, dur: 0.35 },
//     { freq: 220.00, time: 0.48, dur: 0.55 },
//   ];

//   for (let i = 0; i < numSamples; i++) {
//     const t = i / SR;
//     let s = 0;

//     for (const note of notes) {
//       const dt = t - note.time;
//       if (dt >= 0 && dt < note.dur) {
//         const env = dt < 0.015
//           ? dt / 0.015
//           : Math.exp(-(dt - 0.015) * 4.0);

//         const f = note.freq;
//         // Warm mellow vibraphone / soft Rhodes tone
//         const tone =
//           Math.sin(2 * Math.PI * f * dt) * 0.7 +
//           Math.sin(2 * Math.PI * (f * 2) * dt) * 0.2 +
//           Math.sin(2 * Math.PI * (f * 3) * dt) * 0.05;

//         s += tone * env * 0.26;
//       }
//     }

//     samples[i] = s * 0.7;
//   }
//   return samples;
// }

// // Generate all sound effects
// console.log('Generating audio assets in:', outputDir);
// writeWav('card-select.wav', generateCardSelect());
// writeWav('card-drop.wav', generateCardDrop());
// writeWav('card-draw.wav', generateCardDraw());
// writeWav('card-pick.wav', generateCardPick());
// writeWav('card-shuffle.wav', generateCardShuffle());
// writeWav('win.wav', generateWinJingle());
// writeWav('lose.wav', generateLoseTone());
// console.log('All sounds generated successfully!');
