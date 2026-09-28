// Tiny UI sounds, synthesised with Web Audio — no audio files to download.
// Only ever played in response to the user's own action (a send), per
// Apple's rule of causality; failures are silent.
let ctx = null

function audio() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = ctx || new AC()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// A soft "swoosh": filtered noise sweeping up and across, like mail leaving.
export function playSwoosh(volume = 0.32) {
  try {
    const ac = audio()
    if (!ac) return
    const dur = 0.55
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ac.createBufferSource()
    src.buffer = buf
    const t = ac.currentTime
    const band = ac.createBiquadFilter()
    band.type = 'bandpass'
    band.Q.value = 1.1
    band.frequency.setValueAtTime(320, t)
    band.frequency.exponentialRampToValueAtTime(3400, t + 0.26)
    band.frequency.exponentialRampToValueAtTime(1100, t + dur)
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.11)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(band).connect(gain)
    if (ac.createStereoPanner) {
      const pan = ac.createStereoPanner()
      pan.pan.setValueAtTime(-0.55, t)
      pan.pan.linearRampToValueAtTime(0.7, t + dur)
      gain.connect(pan).connect(ac.destination)
    } else {
      gain.connect(ac.destination)
    }
    src.start(t)
    src.stop(t + dur)
  } catch {
    /* no sound is fine */
  }
}
