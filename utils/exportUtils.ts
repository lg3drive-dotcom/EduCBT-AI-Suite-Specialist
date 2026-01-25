
import { EduCBTQuestion, QuestionType } from "../types";

const getSoalHtml = (questions: EduCBTQuestion[]) => {
  const firstQ = questions[0];
  const isMultiChoice = (q: EduCBTQuestion) => {
    const typeStr = (q.type || "").toLowerCase();
    return q.type === QuestionType.MCMA || 
      q.type === QuestionType.Kompleks || 
      typeStr.includes('jamak') || 
      typeStr.includes('kompleks');
  };

  const isBS = (q: EduCBTQuestion) => q.type === QuestionType.KompleksBS;

  return `
    <div id="pdf-content-wrapper" style="font-family: 'Times New Roman', serif; padding: 50px; color: black; background: white; width: 700px; margin: 0 auto; line-height: 1.6;">
      <div style="text-align: center; font-weight: bold; font-size: 16pt; text-transform: uppercase; margin-bottom: 5px;">NASKAH SOAL UJIAN</div>
      <div style="text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 25px;">MATA PELAJARAN: ${firstQ?.subject || '-'}</div>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11pt;">
        <tr><td style="width: 20%; padding: 2px 0;">Mata Pelajaran</td><td style="width: 2%;">:</td><td>${firstQ?.subject || '-'}</td></tr>
        <tr><td style="padding: 2px 0;">Fase / Kelas</td><td>:</td><td>${firstQ?.phase || '-'}</td></tr>
        <tr><td style="padding: 2px 0;">Token Paket</td><td>:</td><td>${firstQ?.quizToken || '-'}</td></tr>
        <tr><td style="padding: 2px 0;">Waktu</td><td>:</td><td>.......... Menit</td></tr>
      </table>
      <hr style="border: 1px solid black; margin-bottom: 30px;" />

      ${questions.map((q, idx) => `
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <div style="display: flex; gap: 15px;">
            <div style="font-weight: bold; min-width: 30px; font-size: 12pt;">${idx + 1}.</div>
            <div style="flex: 1;">
              ${isMultiChoice(q) ? `<div style="color: #d11; font-weight: bold; font-style: italic; font-size: 10pt; margin-bottom: 8px;">(Jawaban bisa lebih dari satu)</div>` : ''}
              ${isBS(q) ? `<div style="color: #d11; font-weight: bold; font-style: italic; font-size: 10pt; margin-bottom: 8px;">(Tentukan ${q.tfLabels?.true || 'Benar'} atau ${q.tfLabels?.false || 'Salah'} pada setiap pernyataan)</div>` : ''}
              
              <div style="font-weight: bold; margin-bottom: 12px; font-size: 12pt; text-align: justify;">${q.text || ''}</div>
              ${q.image ? `<div style="margin: 15px 0;"><img src="${q.image}" style="max-width: 100%; height: auto; border: 1px solid #ddd; display: block;" /></div>` : ''}
              
              <div style="margin-top: 12px; margin-left: 5px;">
                ${isBS(q) ? `
                  <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11pt;">
                    <thead>
                      <tr style="background-color: #f9f9f9;">
                        <th style="border: 1px solid black; padding: 5px; text-align: center; width: 50px;">No</th>
                        <th style="border: 1px solid black; padding: 5px; text-align: left;">Pernyataan</th>
                        <th style="border: 1px solid black; padding: 5px; text-align: center; width: 60px;">${q.tfLabels?.true || 'B'}</th>
                        <th style="border: 1px solid black; padding: 5px; text-align: center; width: 60px;">${q.tfLabels?.false || 'S'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${q.options.map((opt, i) => `
                        <tr>
                          <td style="border: 1px solid black; padding: 5px; text-align: center;">${i+1}</td>
                          <td style="border: 1px solid black; padding: 5px;">${opt}</td>
                          <td style="border: 1px solid black; padding: 5px; text-align: center;"></td>
                          <td style="border: 1px solid black; padding: 5px; text-align: center;"></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : `
                  ${(q.options || []).map((opt, oIdx) => `
                    <div style="margin-bottom: 10px; display: flex; gap: 12px; align-items: flex-start;">
                      <span style="font-weight: bold; min-width: 25px;">${String.fromCharCode(65 + oIdx)}.</span>
                      <div style="flex: 1;">
                        <div style="font-size: 11pt;">${opt || ''}</div>
                        ${q.optionImages?.[oIdx] ? `<div style="margin-top: 8px;"><img src="${q.optionImages[oIdx]}" style="max-width: 200px; height: auto; border: 1px solid #eee;" /></div>` : ''}
                      </div>
                    </div>
                  `).join('')}
                `}
              </div>
            </div>
          </div>
        </div>
      `).join('')}

      <div style="margin-top: 50px; border-top: 2px dashed #666; padding-top: 40px; page-break-before: always;">
        <div style="text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 25px; text-decoration: underline;">KUNCI JAWABAN & PEMBAHASAN</div>
        <table style="width: 100%; border-collapse: collapse; border: 1.5pt solid black;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1.5pt solid black; padding: 12px; width: 8%; text-align: center;">No</th>
              <th style="border: 1.5pt solid black; padding: 12px; width: 18%; text-align: center;">Kunci</th>
              <th style="border: 1.5pt solid black; padding: 12px; text-align: left;">Pembahasan</th>
            </tr>
          </thead>
          <tbody>
            ${questions.map((q, idx) => {
              let key = '';
              if (typeof q.correctAnswer === 'number') {
                key = String.fromCharCode(65 + q.correctAnswer);
              } else if (Array.isArray(q.correctAnswer)) {
                if (q.type === QuestionType.KompleksBS) {
                  key = q.correctAnswer.map((val, i) => {
                    return val ? q.tfLabels?.true?.[0] || 'B' : q.tfLabels?.false?.[0] || 'S';
                  }).join(', ');
                } else {
                  key = q.correctAnswer.map((val, i) => {
                    if (typeof val === 'boolean') return val ? String.fromCharCode(65 + i) : null;
                    if (typeof val === 'number') return String.fromCharCode(65 + val);
                    return null;
                  }).filter(v => v !== null).join(', ');
                }
              }
              return `
                <tr>
                  <td style="border: 1pt solid black; padding: 10px; text-align: center; font-weight: bold;">${idx + 1}</td>
                  <td style="border: 1pt solid black; padding: 10px; text-align: center; font-weight: bold;">${key}</td>
                  <td style="border: 1pt solid black; padding: 10px; font-size: 10pt;">${q.explanation || '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

const getKisiKisiHtml = (questions: EduCBTQuestion[]) => {
  const firstQ = questions[0];
  return `
    <div id="pdf-content-wrapper" style="font-family: 'Times New Roman', serif; padding: 50px; color: black; background: white; width: 700px; margin: 0 auto;">
      <div style="text-align: center; font-weight: bold; font-size: 16pt; text-transform: uppercase; margin-bottom: 5px;">KISI-KISI PENULISAN SOAL</div>
      <div style="text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 35px;">MATA PELAJARAN: ${firstQ?.subject || '-'}</div>
      
      <table style="width: 100%; border-collapse: collapse; border: 1.5pt solid black; font-size: 10pt;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1.5pt solid black; padding: 12px; text-align: center;">No</th>
            <th style="border: 1.5pt solid black; padding: 12px; text-align: left;">Materi</th>
            <th style="border: 1.5pt solid black; padding: 12px; text-align: center;">Level</th>
            <th style="border: 1.5pt solid black; padding: 12px; text-align: left;">Bentuk Soal</th>
            <th style="border: 1.5pt solid black; padding: 12px; text-align: center;">No. Soal</th>
          </tr>
        </thead>
        <tbody>
          ${questions.map((q, idx) => `
            <tr>
              <td style="border: 1pt solid black; padding: 10px; text-align: center;">${idx + 1}</td>
              <td style="border: 1pt solid black; padding: 10px;">${q.material || ''}</td>
              <td style="border: 1pt solid black; padding: 10px; text-align: center;">${q.level || ''}</td>
              <td style="border: 1pt solid black; padding: 10px;">${q.type || ''}</td>
              <td style="border: 1pt solid black; padding: 10px; text-align: center;">${idx + 1}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
};

const generatePdfFromHtml = async (html: string, filename: string) => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '700px'; 
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const images = Array.from(container.getElementsByTagName('img'));
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
    }));

    // @ts-ignore
    const canvas = await window.html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    // @ts-ignore
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;
    const verticalOffset = 15;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - verticalOffset);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position + verticalOffset, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - verticalOffset);
    }

    pdf.save(filename);
  } catch (err) {
    console.error("PDF Error:", err);
    alert("Gagal membuat PDF.");
  } finally {
    document.body.removeChild(container);
  }
};

export const downloadSoalPdf = async (questions: EduCBTQuestion[]) => {
  if (!questions || questions.length === 0) return;
  const safeSubject = (questions[0]?.subject || 'Soal').toString().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
  await generatePdfFromHtml(getSoalHtml(questions), `Soal_${safeSubject}.pdf`);
};

export const downloadKisiKisiPdf = async (questions: EduCBTQuestion[]) => {
  if (!questions || questions.length === 0) return;
  const safeSubject = (questions[0]?.subject || 'KisiKisi').toString().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
  await generatePdfFromHtml(getKisiKisiHtml(questions), `KisiKisi_${safeSubject}.pdf`);
};

export const downloadSoalDoc = (questions: EduCBTQuestion[]) => {
  if (!questions || questions.length === 0) return;
  try {
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Naskah Soal</title></head><body>`;
    const blob = new Blob(['\ufeff', header + getSoalHtml(questions) + "</body></html>"], { type: 'application/vnd.ms-word' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeSubject = (questions[0]?.subject || 'Soal').toString().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
    link.href = url;
    link.download = `Soal_${safeSubject}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) { alert("Gagal menyusun file Word."); }
};

export const downloadKisiKisiDoc = (questions: EduCBTQuestion[]) => {
  if (!questions || questions.length === 0) return;
  try {
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Kisi-kisi</title></head><body>`;
    const blob = new Blob(['\ufeff', header + getKisiKisiHtml(questions) + "</body></html>"], { type: 'application/vnd.ms-word' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeSubject = (questions[0]?.subject || 'KisiKisi').toString().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
    link.href = url;
    link.download = `KisiKisi_${safeSubject}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) { alert("Gagal menyusun kisi-kisi."); }
};
