import PptxGenJS from 'pptxgenjs';
import { jsPDF } from 'jspdf';
import { PresentationRecord } from '../types';

function stripHash(hex?: string, fallback = '1D4ED8'): string {
  if (!hex) return fallback;
  return hex.replace('#', '').toUpperCase();
}

export async function exportPresentationToPptx(deck: PresentationRecord): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'SUTRO SATHI';
  pptx.title = deck.title;
  pptx.subject = deck.subject;

  for (const slide of deck.slides) {
    const s = pptx.addSlide();
    s.background = { color: stripHash(slide.backgroundColor, 'FFFFFF') };

    const accent = stripHash(slide.accentColor, '1D4ED8');
    const titleColor = stripHash(slide.titleColor, '0F172A');
    const textColor = stripHash(slide.textColor, '334155');

    // Top accent bar
    s.addShape('rect', {
      x: 0,
      y: 0,
      w: 10,
      h: 0.12,
      fill: { color: accent },
      line: { color: accent },
    });

    if (slide.layout === 'title') {
      s.addText(slide.title, {
        x: 0.8,
        y: 1.5,
        w: 8.4,
        h: 1.4,
        fontSize: 32,
        bold: true,
        color: titleColor,
        align: 'left',
        valign: 'middle',
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.8,
          y: 2.95,
          w: 8.4,
          h: 0.7,
          fontSize: 18,
          color: textColor,
          align: 'left',
        });
      }
    } else {
      s.addText(slide.title, {
        x: 0.6,
        y: 0.35,
        w: 8.8,
        h: 0.65,
        fontSize: 22,
        bold: true,
        color: titleColor,
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.6,
          y: 0.95,
          w: 8.8,
          h: 0.35,
          fontSize: 12,
          color: accent,
        });
      }
    }

    for (const el of slide.elements) {
      const x = (el.xPercent / 100) * 10;
      const y = (el.yPercent / 100) * 5.625;
      const w = Math.max(0.8, (el.wPercent / 100) * 10);
      const h = Math.max(0.4, (el.hPercent / 100) * 5.625);

      if (el.kind === 'text') {
        s.addText(el.text || '', {
          x,
          y,
          w,
          h,
          fontSize: el.fontSize || 15,
          bold: el.bold,
          color: stripHash(el.fontColor, textColor),
          align: el.align || 'left',
          valign: 'top',
        });
      } else if (el.kind === 'bullets' && el.bullets && el.bullets.length > 0) {
        const items = el.bullets.map((b) => ({
          text: b,
          options: { bullet: true, breakLine: true },
        }));
        s.addText(items, {
          x,
          y,
          w,
          h,
          fontSize: el.fontSize || 15,
          color: stripHash(el.fontColor, textColor),
          valign: 'top',
        });
      } else if (el.kind === 'shape') {
        const shapeName =
          el.shapeType === 'circle'
            ? 'ellipse'
            : el.shapeType === 'arrow-right'
              ? 'rightArrow'
              : el.shapeType === 'rounded'
                ? 'roundRect'
                : 'rect';
        s.addShape(shapeName, {
          x,
          y,
          w,
          h,
          fill: { color: stripHash(el.bgColor, accent) },
          line: { color: stripHash(el.borderColor || el.bgColor, accent) },
        });
        if (el.text) {
          s.addText(el.text, {
            x,
            y,
            w,
            h,
            fontSize: el.fontSize || 13,
            color: stripHash(el.fontColor, 'FFFFFF'),
            align: 'center',
            valign: 'middle',
          });
        }
      } else if (el.kind === 'diagram' && el.diagramNodes && el.diagramNodes.length > 0) {
        const count = el.diagramNodes.length;
        const boxW = Math.min(2.0, (w - 0.3 * (count - 1)) / count);
        el.diagramNodes.forEach((node, idx) => {
          const nx = x + idx * (boxW + 0.3);
          s.addShape('roundRect', {
            x: nx,
            y: y + 0.3,
            w: boxW,
            h: 1.1,
            fill: { color: accent },
            line: { color: accent },
          });
          s.addText(node, {
            x: nx + 0.05,
            y: y + 0.35,
            w: boxW - 0.1,
            h: 1.0,
            fontSize: 12,
            bold: true,
            color: 'FFFFFF',
            align: 'center',
            valign: 'middle',
          });
        });
      } else if (el.kind === 'chart' && el.chartSeries && el.chartSeries.length > 0) {
        const labels = el.chartSeries.map((c) => c.label);
        const values = el.chartSeries.map((c) => c.value);
        const chartKind =
          el.chartType === 'pie'
            ? pptx.ChartType.pie
            : el.chartType === 'line'
              ? pptx.ChartType.line
              : pptx.ChartType.bar;
        s.addChart(
          chartKind,
          [{ name: el.chartTitle || 'Data', labels, values }],
          {
            x,
            y,
            w,
            h,
            showTitle: Boolean(el.chartTitle),
            title: el.chartTitle || '',
            chartColors: [accent, '0D9488', 'D97706', 'DC2626', '7C3AED'],
          }
        );
      } else if (el.kind === 'table' && el.tableHeaders && el.tableRows) {
        const rows = [
          el.tableHeaders.map((hdr) => ({
            text: hdr,
            options: { bold: true, fill: { color: accent }, color: 'FFFFFF' },
          })),
          ...el.tableRows.map((r) => r.map((cell) => ({ text: cell }))),
        ];
        s.addTable(rows, {
          x,
          y,
          w,
          fontSize: 11,
          border: { pt: 1, color: 'CBD5E1' },
        });
      } else if (el.kind === 'image' && el.imageDataUrl) {
        s.addImage({
          data: el.imageDataUrl,
          x,
          y,
          w,
          h,
        });
      }
    }

    if (slide.speakerNotes) {
      s.addNotes(slide.speakerNotes);
    }
  }

  const safeName = deck.title.replace(/[^a-zA-Z0-9_\-\u0980-\u09FF ]+/g, '_') || 'presentation';
  await pptx.writeFile({ fileName: `${safeName}.pptx` });
}

export async function exportPresentationToPdf(deck: PresentationRecord): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [254, 142.875] });
  deck.slides.forEach((slide, idx) => {
    if (idx > 0) pdf.addPage([254, 142.875], 'landscape');
    pdf.setFillColor(slide.backgroundColor || '#ffffff');
    pdf.rect(0, 0, 254, 142.875, 'F');

    pdf.setFillColor(slide.accentColor || '#1d4ed8');
    pdf.rect(0, 0, 254, 4, 'F');

    pdf.setTextColor(slide.titleColor || '#0f172a');
    pdf.setFontSize(slide.layout === 'title' ? 24 : 18);
    pdf.text(slide.title.slice(0, 80), 16, slide.layout === 'title' ? 50 : 20);

    if (slide.subtitle) {
      pdf.setTextColor(slide.textColor || '#475569');
      pdf.setFontSize(12);
      pdf.text(slide.subtitle.slice(0, 100), 16, slide.layout === 'title' ? 62 : 28);
    }

    let cursorY = slide.layout === 'title' ? 78 : 40;
    pdf.setFontSize(11);
    pdf.setTextColor(slide.textColor || '#334155');
    for (const el of slide.elements) {
      if (el.kind === 'bullets' && el.bullets) {
        for (const b of el.bullets) {
          pdf.text(`• ${b}`, 18, cursorY, { maxWidth: 218 });
          cursorY += 9;
        }
      } else if (el.kind === 'text' && el.text) {
        pdf.text(el.text, 18, cursorY, { maxWidth: 218 });
        cursorY += 10;
      } else if (el.kind === 'diagram' && el.diagramNodes) {
        pdf.text(el.diagramNodes.join('  →  '), 18, cursorY, { maxWidth: 218 });
        cursorY += 12;
      } else if (el.kind === 'chart' && el.chartSeries) {
        const line = el.chartSeries.map((c) => `${c.label}: ${c.value}`).join(' | ');
        pdf.text(`${el.chartTitle || 'Chart'}: ${line}`, 18, cursorY, { maxWidth: 218 });
        cursorY += 12;
      }
    }

    pdf.setFontSize(8);
    pdf.setTextColor('#94a3b8');
    pdf.text(`SUTRO SATHI · ${idx + 1} / ${deck.slides.length}`, 220, 136);
  });

  const safeName = deck.title.replace(/[^a-zA-Z0-9_\-\u0980-\u09FF ]+/g, '_') || 'presentation';
  pdf.save(`${safeName}.pdf`);
}
