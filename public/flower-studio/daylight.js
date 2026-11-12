// Local device time drives an illustrative 06:00–18:00 solar cycle.
// No location is requested; this is not an astronomical sunrise calculation.
const frames = [
  [0, '#101a36', '#384b70', '#142c4c', '#294963'],
  [5, '#283658', '#c1848b', '#355975', '#6b8b9c'],
  [6, '#849bb8', '#f7c499', '#597f98', '#84b5bd'],
  [8, '#80b9db', '#dbe9df', '#3e85a5', '#7dbfc2'],
  [12, '#6aadd3', '#d3e8e8', '#297b9e', '#6bb7be'],
  [16, '#93bed3', '#f1dfbe', '#4d91a9', '#89bfc0'],
  [18, '#697b9f', '#f4a485', '#4b6e88', '#7595a1'],
  [19, '#263353', '#7d7593', '#233f60', '#4a647e'],
  [24, '#101a36', '#384b70', '#142c4c', '#294963'],
];
function mixHex(a, b, t) {
  const aa = parseInt(a.slice(1), 16), bb = parseInt(b.slice(1), 16);
  return '#' + [16, 8, 0].map(s => Math.round(((aa >> s) & 255) * (1 - t) + ((bb >> s) & 255) * t).toString(16).padStart(2, '0')).join('');
}
export function daylightAt(date = new Date()) {
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const i = frames.findIndex((frame, index) => index > 0 && hour < frame[0]);
  const a = frames[i - 1], b = frames[i], t = (hour - a[0]) / (b[0] - a[0]);
  const progress = Math.max(0, Math.min(1, (hour - 6) / 12));
  const daylight = Math.max(0, Math.sin(Math.PI * progress));
  const phase = hour < 5 || hour >= 19 ? 'Đêm trên biển' : hour < 7 ? 'Bình minh trên biển' : hour < 16.5 ? 'Nắng trên đại dương' : 'Hoàng hôn trên biển';
  return {
    hour, progress, daylight, phase, sunVisible: hour >= 6 && hour < 18,
    night: hour < 5 || hour >= 19,
    skyTop: mixHex(a[1], b[1], t), skyHorizon: mixHex(a[2], b[2], t),
    seaTop: mixHex(a[3], b[3], t), seaBottom: mixHex(a[4], b[4], t),
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}
