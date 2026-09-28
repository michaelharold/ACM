import SquishSwitch from '../reactbits/SquishSwitch'

// Brand tones for the "on" track; each glows softly in its own colour.
const ON = {
  acm: '#1f47f5',
  violet: '#8b5cf6',
  sky: '#0ea5e9',
  emerald: '#10b981',
}

// The site's on/off switch — React Bits' SquishSwitch (the thumb stretches
// with speed and can be dragged), sized and coloured for the admin forms.
export function Switch({ on, onClick, tone = 'acm', disabled = false, label }) {
  return (
    <SquishSwitch
      checked={!!on}
      onChange={(next) => { if (next !== !!on) onClick?.() }}
      ariaLabel={label}
      disabled={disabled}
      width={46}
      height={26}
      radius={13}
      speed={38}
      stretch={42}
      hoverScale={1.06}
      colorDuration={380}
      trackColor="#3f3f46"
      trackOnColor={ON[tone] || ON.acm}
      thumbColor="#d4d4d8"
      thumbOnColor="#ffffff"
      className="site-switch"
    />
  )
}
