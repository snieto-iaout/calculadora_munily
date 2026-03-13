/* ═══════════════════════════════════════════════════════
   Calculadora de Ahorro — Munily
   Lógica de cálculo, UI y generación de PDF
   ═══════════════════════════════════════════════════════ */

'use strict';

// ─── Estado ───────────────────────────────────────────────
let serviciosAlto = true;

// Guarda el último resultado calculado para el PDF
let lastCalc = null;

// ─── Formateo de números ──────────────────────────────────
function fmt(n, sym) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  sym = (sym || '').trim();
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return sym + (n / 1_000_000_000).toFixed(1) + 'B';
  if (abs >= 1_000_000)     return sym + (n / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000)         return sym + Math.round(n / 1_000) + 'k';
  return sym + Math.round(n).toLocaleString('es');
}

function fmtFull(n, sym) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  sym = (sym || '').trim();
  return sym + Math.round(n).toLocaleString('es');
}

function fmtPct(n, decimals) {
  if (isNaN(n) || !isFinite(n)) return '—';
  return n.toFixed(decimals ?? 1) + '%';
}

// ─── Tiers de costo Munily ────────────────────────────────
function getMunilyTier(units) {
  if (units <= 50)  return { label: '20 – 50 unidades',   impl: 0.25,  mensual: 0.025  };
  if (units <= 100) return { label: '51 – 100 unidades',  impl: 0.375, mensual: 0.0438 };
  if (units <= 200) return { label: '101 – 200 unidades', impl: 0.625, mensual: 0.0625 };
  return                   { label: '200+ unidades',      impl: 1.0,   mensual: 0.1    };
}

// ─── Toggle consumo de servicios ─────────────────────────
function setServicios(val) {
  serviciosAlto = val;
  document.getElementById('btn-si').classList.toggle('active', val);
  document.getElementById('btn-no').classList.toggle('active', !val);
  calculate();
}

// ─── Función principal de cálculo ────────────────────────
function calculate() {
  const sym       = (document.getElementById('currency').value || '$').trim();
  const budget    = parseFloat(document.getElementById('budget').value)         || 0;
  const units     = parseInt(document.getElementById('units').value)            || 100;
  const mora      = parseInt(document.getElementById('mora').value)             || 0;
  const muniInput = parseFloat(document.getElementById('munily-cost').value)    || 0;
  const typeEl    = document.getElementById('type');
  const typeLabel = typeEl.options[typeEl.selectedIndex].text;

  const P       = budget;
  const moraAdj = Math.min(mora / 100, 0.30);

  const aAdmin = P * 0.07 * 0.20;
  const aMora  = P * 0.08 * (0.30 + moraAdj * 0.5);
  const aSrv   = P * 0.10 * (serviciosAlto ? 0.15 : 0.12);
  const aMant  = P * 0.07 * 0.15;
  const aCom   = P * 0.03 * 0.20;

  const aTotal  = aAdmin + aMora + aSrv + aMant + aCom;
  const aAnual  = aTotal * 12;
  const aPct    = P > 0 ? (aTotal / P) * 100 : 0;
  const aUnidad = units > 0 ? aTotal / units : 0;

  const tier       = getMunilyTier(units);
  const implRef    = P * tier.impl;
  const mensualRef = P * tier.mensual;
  const anualRef   = mensualRef * 12;

  const hasCosto       = muniInput > 0;
  const costoMens      = hasCosto ? muniInput : mensualRef;
  const costoAnual     = costoMens * 12;
  const netoAnual      = aAnual - costoAnual;
  const ahorroMensNeto = aTotal - costoMens;
  const roi            = implRef > 0 ? ((netoAnual - implRef) / implRef) * 100 : 0;
  const paybackMes     = ahorroMensNeto > 0 ? implRef / ahorroMensNeto : Infinity;

  // Guardar para PDF
  lastCalc = {
    sym, budget, units, mora, typeLabel, serviciosAlto, hasCosto,
    muniInput, aAdmin, aMora, aSrv, aMant, aCom, aTotal, aAnual,
    aPct, aUnidad, tier, implRef, mensualRef, anualRef, costoMens,
    costoAnual, netoAnual, roi, paybackMes,
    fecha: new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' }),
  };

  // ── Actualizar UI ──────────────────────────────────────
  setText('res-mensual',     fmt(aTotal, sym));
  setText('res-mensual-pct', `${fmtPct(aPct)} del presupuesto mensual`);
  setText('res-anual',       fmt(aAnual,  sym));
  setText('res-unidad',      fmt(aUnidad, sym));
  setText('res-pct',         fmtPct(aPct));

  if (isFinite(roi) && roi > 0) {
    setText('res-roi', Math.round(roi) + '%');
    showEl('metric-roi', true);
  } else {
    showEl('metric-roi', false);
  }

  if (isFinite(paybackMes) && paybackMes > 0) {
    setText('res-payback', paybackMes < 1 ? '< 1 mes' : Math.round(paybackMes) + ' meses');
    showEl('metric-payback', true);
  } else {
    showEl('metric-payback', false);
  }

  setText('res-neto', fmt(netoAnual, sym));

  const cats = [
    { id: 'b-admin', bar: 'bar-admin', val: aAdmin },
    { id: 'b-mora',  bar: 'bar-mora',  val: aMora  },
    { id: 'b-srv',   bar: 'bar-srv',   val: aSrv   },
    { id: 'b-mant',  bar: 'bar-mant',  val: aMant  },
    { id: 'b-com',   bar: 'bar-com',   val: aCom   },
  ];
  const maxVal = Math.max(...cats.map(c => c.val), 1);
  cats.forEach(c => {
    setText(c.id, fmt(c.val, sym));
    setWidth(c.bar, maxVal > 0 ? (c.val / maxVal * 100) : 0);
  });

  setText('cost-range',       tier.label);
  setText('cost-impl',        fmt(implRef,    sym));
  setText('cost-mensual-ref', fmt(mensualRef, sym) + '/mes');
  setText('cost-anual-ref',   fmt(anualRef,   sym) + '/año');
  setText('cost-bruto',       fmt(aAnual,     sym));
  setText('cost-neto',        fmt(netoAnual,  sym));

  const notaEl = document.getElementById('cost-nota');
  if (notaEl) {
    notaEl.textContent = hasCosto
      ? '✅ Cálculo usando tu cotización real de Munily.'
      : '💡 Usando costos de referencia. Ingresa tu cotización para un resultado exacto.';
  }

  triggerPulse('res-mensual');
}

// ─── Helpers DOM ──────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function showEl(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? '' : 'none';
}

function setWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = pct + '%';
}

function triggerPulse(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}

// ─── Listeners de sliders ─────────────────────────────────
function initSlider(sliderId, displayId, formatFn) {
  const slider  = document.getElementById(sliderId);
  const display = document.getElementById(displayId);
  if (!slider) return;
  slider.addEventListener('input', () => {
    const val = formatFn ? formatFn(slider.value) : slider.value;
    if (display) display.textContent = val;
    calculate();
  });
}

// ═══════════════════════════════════════════════════════════
// GENERACIÓN DE PDF
// ═══════════════════════════════════════════════════════════

async function loadLogoBase64() {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = 'munily.png?' + Date.now();
  });
}

async function generatePDF() {
  if (!lastCalc) { alert('Primero completa la calculadora.'); return; }
  if (!window.jspdf) { alert('La librería PDF no está cargada. Verifica tu conexión.'); return; }

  const btn = document.getElementById('btn-pdf');
  if (btn) { btn.textContent = '⏳ Generando…'; btn.disabled = true; }

  try {
    const { jsPDF } = window.jspdf;
    const c  = lastCalc;
    const s  = c.sym;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // ── Colores ──
    const NAVY   = [7,   25,  49];
    const BLUE   = [61,  136, 227];
    const BLUE2  = [26,  95,  196];
    const LGRAY  = [237, 244, 253];
    const GRAY   = [107, 119, 140];
    const LGRAY2 = [245, 248, 255];
    const GREEN  = [34,  197, 94];
    const ORANGE = [232, 134, 59];
    const WHITE  = [255, 255, 255];
    const DARK   = [10,  2,   38];
    const BORDER = [214, 228, 246];

    const W  = 210;
    const MX = 14;   // margen horizontal
    const CW = W - MX * 2; // ancho de contenido

    let y = 0; // cursor vertical

    // ══════════════════════════════════════════════════════
    // CABECERA — fondo navy
    // ══════════════════════════════════════════════════════
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 44, 'F');

    // Logo
    const logoB64 = await loadLogoBase64();
    if (logoB64) {
      doc.addImage(logoB64, 'PNG', MX, 10, 44, 18);
    } else {
      // Fallback: texto "Munily"
      doc.setTextColor(...BLUE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('Munily', MX, 24);
    }

    // Título del informe (derecha)
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Informe de Ahorro', W - MX, 17, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(180, 200, 230);
    doc.text(c.fecha, W - MX, 25, { align: 'right' });
    doc.text(c.typeLabel, W - MX, 31, { align: 'right' });

    y = 52;

    // ══════════════════════════════════════════════════════
    // BLOQUE AHORRO PRINCIPAL — fondo degradado simulado
    // ══════════════════════════════════════════════════════
    doc.setFillColor(...BLUE2);
    doc.roundedRect(MX, y, CW, 36, 4, 4, 'F');
    // acento superior claro
    doc.setFillColor(61, 136, 227, 0.4);
    doc.roundedRect(MX, y, CW, 6, 4, 4, 'F');

    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('AHORRO MENSUAL ESTIMADO', MX + 6, y + 11);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text(fmt(c.aTotal, s), MX + 6, y + 23);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(180, 210, 255);
    doc.text(`${fmtPct(c.aPct)} del presupuesto mensual`, MX + 6, y + 31);

    // Badges a la derecha
    const bx = MX + CW * 0.55;
    const pillW = 56;

    // Badge Anual
    doc.setFillColor(255, 255, 255, 0.12);
    doc.roundedRect(bx, y + 8, pillW, 8, 2, 2, 'F');
    doc.setTextColor(180, 210, 255);
    doc.setFontSize(7);
    doc.text('ANUAL', bx + 4, y + 13.5);
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(fmt(c.aAnual, s), bx + pillW - 3, y + 13.5, { align: 'right' });

    // Badge Por unidad
    doc.setFillColor(255, 255, 255, 0.08);
    doc.roundedRect(bx, y + 20, pillW, 8, 2, 2, 'F');
    doc.setTextColor(180, 210, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('POR UNIDAD/MES', bx + 4, y + 25.5);
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(fmt(c.aUnidad, s), bx + pillW - 3, y + 25.5, { align: 'right' });

    y += 44;

    // ══════════════════════════════════════════════════════
    // MÉTRICAS CLAVE — 4 cajitas en fila
    // ══════════════════════════════════════════════════════
    y += 6;
    const mW = (CW - 12) / 4;

    const metrics = [
      { label: '% DEL PRESUPUESTO', value: fmtPct(c.aPct),                        color: BLUE  },
      { label: 'AHORRO NETO ANUAL', value: fmt(c.netoAnual, s),                    color: GREEN },
      { label: 'TIEMPO ADMIN',      value: '93%',                                  color: GREEN },
      { label: 'ROI PRIMER AÑO',    value: isFinite(c.roi) && c.roi > 0 ? Math.round(c.roi) + '%' : 'N/A', color: BLUE },
    ];

    metrics.forEach((m, i) => {
      const mx2 = MX + i * (mW + 4);
      doc.setFillColor(...LGRAY);
      doc.roundedRect(mx2, y, mW, 18, 3, 3, 'F');
      doc.setTextColor(...GRAY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text(m.label, mx2 + mW / 2, y + 6, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...m.color);
      doc.text(m.value, mx2 + mW / 2, y + 14, { align: 'center' });
    });

    y += 25;

    // ══════════════════════════════════════════════════════
    // DOS COLUMNAS: Datos ingresados | Desglose por categoría
    // ══════════════════════════════════════════════════════
    const col1x = MX;
    const col2x = MX + CW / 2 + 4;
    const colW  = CW / 2 - 4;

    // ── Columna 1: Datos del conjunto ──
    doc.setFillColor(...LGRAY2);
    doc.roundedRect(col1x, y, colW, 68, 3, 3, 'F');

    doc.setFillColor(...BLUE);
    doc.roundedRect(col1x, y, 3, 68, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('Datos del conjunto', col1x + 8, y + 8);

    const inputData = [
      ['Presupuesto mensual',  fmtFull(c.budget, s)],
      ['Número de unidades',   c.units + ' unidades'],
      ['Tipo de propiedad',    c.typeLabel],
      ['Tasa de morosidad',    c.mora + '%'],
      ['Consumo de servicios', c.serviciosAlto ? 'Alto' : 'Normal'],
      ['Cotización Munily',    c.hasCosto ? fmtFull(c.muniInput, s) + '/mes' : 'Referencia de mercado'],
    ];

    inputData.forEach(([label, val], i) => {
      const ry = y + 16 + i * 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text(label, col1x + 8, ry);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text(val, col1x + colW - 4, ry, { align: 'right' });
    });

    // ── Columna 2: Desglose por categoría ──
    doc.setFillColor(...LGRAY2);
    doc.roundedRect(col2x, y, colW, 68, 3, 3, 'F');

    doc.setFillColor(...GREEN);
    doc.roundedRect(col2x, y, 3, 68, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('Desglose de ahorro', col2x + 8, y + 8);

    const catColors = [BLUE, [13,158,110], ORANGE, [139,92,246], [236,72,153]];
    const catData = [
      ['Administración y gestión', c.aAdmin],
      ['Reducción de morosidad',   c.aMora],
      ['Servicios públicos',       c.aSrv],
      ['Mantenimiento preventivo', c.aMant],
      ['Comunicación eficiente',   c.aCom],
    ];
    const catTotal = catData.reduce((sum, [, v]) => sum + v, 0);

    catData.forEach(([label, val], i) => {
      const ry    = y + 16 + i * 10;
      const pct   = catTotal > 0 ? val / catTotal : 0;
      const barW  = (colW - 12) * pct;

      // Fila label + valor
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY);
      doc.text(label, col2x + 8, ry);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text(fmt(val, s), col2x + colW - 4, ry, { align: 'right' });

      // Barra
      doc.setFillColor(...BORDER);
      doc.roundedRect(col2x + 8, ry + 1.5, colW - 12, 2, 1, 1, 'F');
      doc.setFillColor(...catColors[i]);
      doc.roundedRect(col2x + 8, ry + 1.5, barW, 2, 1, 1, 'F');
    });

    y += 74;

    // ══════════════════════════════════════════════════════
    // TABLA: Referencia de inversión Munily
    // ══════════════════════════════════════════════════════
    doc.setFillColor(...LGRAY2);
    doc.roundedRect(MX, y, CW, 52, 3, 3, 'F');

    doc.setFillColor(...NAVY);
    doc.roundedRect(MX, y, 3, 52, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('Referencia de inversión Munily', MX + 8, y + 9);

    const costRows = [
      ['Rango de unidades',         c.tier.label,                                            DARK],
      ['Implementación (una vez)',   fmt(c.implRef,    s),                                    DARK],
      ['Costo mensual (ref.)',       fmt(c.mensualRef, s) + '/mes',                           DARK],
      ['Costo anual (ref.)',         fmt(c.anualRef,   s) + '/año',                           DARK],
      ['Ahorro bruto anual',         fmt(c.aAnual,     s),                                    BLUE],
      ['Ahorro neto anual estimado', fmt(c.netoAnual,  s),                                    GREEN],
    ];

    costRows.forEach(([label, val, color], i) => {
      const ry = y + 17 + i * 7;
      // Línea separadora
      if (i > 0) {
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.3);
        doc.line(MX + 8, ry - 2, MX + CW - 8, ry - 2);
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text(label, MX + 8, ry);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...color);
      doc.text(val, MX + CW - 8, ry, { align: 'right' });
    });

    y += 58;

    // ══════════════════════════════════════════════════════
    // BLOQUE PAYBACK (si aplica)
    // ══════════════════════════════════════════════════════
    if (isFinite(c.paybackMes) && c.paybackMes > 0 && c.paybackMes < 999) {
      const pb = c.paybackMes < 1 ? 'Menos de 1 mes' : Math.round(c.paybackMes) + ' meses';
      doc.setFillColor(...BLUE);
      doc.roundedRect(MX, y, CW, 12, 3, 3, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(180, 210, 255);
      doc.text('⏱ Período de recuperación de la inversión:', MX + 6, y + 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...WHITE);
      doc.text(pb, MX + CW - 6, y + 8, { align: 'right' });
      y += 18;
    }

    // ══════════════════════════════════════════════════════
    // CTA FINAL
    // ══════════════════════════════════════════════════════
    y = Math.max(y, 255);
    doc.setFillColor(...NAVY);
    doc.roundedRect(MX, y, CW, 18, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.text('¿Quieres ver estos resultados en tu conjunto?', MX + CW / 2, y + 7, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 210, 255);
    doc.text('Solicita una demo personalizada en  munily.com/contactanos', MX + CW / 2, y + 13, { align: 'center' });

    y += 24;

    // ══════════════════════════════════════════════════════
    // FOOTER / DISCLAIMER
    // ══════════════════════════════════════════════════════
    doc.setFillColor(247, 250, 255);
    doc.rect(0, y, W, 297 - y, 'F');
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.4);
    doc.line(0, y, W, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    const disclaimer =
      'Los cálculos presentados son estimaciones basadas en promedios del mercado de propiedad horizontal en Latinoamérica. ' +
      'Los resultados reales pueden variar según las características específicas de cada conjunto, su administración y las condiciones del mercado local. ' +
      'Metodología: Análisis Munily de ahorro para propiedad horizontal — 2025.';
    const lines = doc.splitTextToSize(disclaimer, CW);
    doc.text(lines, MX, y + 7);

    // Pie de página
    doc.setFontSize(6.5);
    doc.setTextColor(160, 170, 185);
    doc.text('© 2025 Munily · Hecho con amor desde LATAM para el mundo · munily.com', W / 2, 293, { align: 'center' });

    // ── Descargar ──
    const filename = `Informe_Ahorro_Munily_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);

  } catch (err) {
    console.error('Error generando PDF:', err);
    alert('Ocurrió un error al generar el PDF. Intenta de nuevo.');
  } finally {
    if (btn) { btn.textContent = '⬇ Descargar informe PDF'; btn.disabled = false; }
  }
}

// ─── Inicialización ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSlider('units', 'units-display', v => v + ' uds.');
  initSlider('mora',  'mora-display',  v => v + '%');

  ['budget', 'currency', 'type', 'munily-cost'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calculate);
  });

  document.getElementById('type')?.addEventListener('change', calculate);

  calculate();
});
