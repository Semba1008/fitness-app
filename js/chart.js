function drawLineChart(canvas, points) {
  const ctx = canvas.getContext('2d');
  const style = getComputedStyle(document.documentElement);
  const mutedColor = style.getPropertyValue('--muted').trim() || '#9aa0a6';
  const borderColor = style.getPropertyValue('--border').trim() || '#e0e0e0';
  const primaryColor = style.getPropertyValue('--primary').trim() || '#3b7cff';

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  if (points.length === 0) {
    ctx.fillStyle = mutedColor;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('記録がありません', cssWidth / 2, cssHeight / 2);
    return;
  }

  const padding = { top: 16, right: 16, bottom: 24, left: 40 };
  const w = cssWidth - padding.left - padding.right;
  const h = cssHeight - padding.top - padding.bottom;
  const values = points.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const yFor = (v) => padding.top + h - ((v - minV) / range) * h;
  const xFor = (i) => padding.left + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (h / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + w, y);
    ctx.stroke();
    const v = maxV - (range / gridLines) * i;
    ctx.fillStyle = mutedColor;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(v.toFixed(1), padding.left - 6, y + 4);
  }

  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.value);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = primaryColor;
  points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.value);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = mutedColor;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  const labelStep = Math.max(1, Math.ceil(points.length / 5));
  points.forEach((p, i) => {
    if (i % labelStep === 0 || i === points.length - 1) {
      ctx.fillText(p.label, xFor(i), cssHeight - 6);
    }
  });
}
