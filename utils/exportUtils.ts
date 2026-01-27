
import { EduCBTQuestion, QuestionType } from "../types";

export const downloadExcelTemplate = () => {
  // @ts-ignore
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();

  // Sheet 1: Format Soal
  const headers = [
    [
      "No", "Tipe Soal", "Level", "Materi", "Teks Soal", "Gambar Soal (URL)",
      "Opsi A", "Gambar Opsi A (URL)", 
      "Opsi B", "Gambar Opsi B (URL)",
      "Opsi C", "Gambar Opsi C (URL)",
      "Opsi D", "Gambar Opsi D (URL)",
      "Opsi E", "Gambar Opsi E (URL)",
      "Kunci Jawaban", "Pembahasan", "Token Paket"
    ]
  ];
  
  const sampleData = [
    [
      1, "Pilihan Ganda", "L1", "Ekosistem", "Apa peran utama tumbuhan hijau dalam ekosistem?", "", 
      "Produsen", "", 
      "Konsumen I", "", 
      "Pengurai", "", 
      "Detritivor", "", 
      "", "", 
      "A", "Tumbuhan menghasilkan makanan sendiri melalui fotosintesis.", "IPA-01"
    ],
    [
      2, "Pilihan Jamak (MCMA)", "L2", "Zat Kimia", "Manakah yang termasuk gas mulia? (Pilih semua yang benar)", "", 
      "Helium", "", 
      "Oksigen", "", 
      "Neon", "", 
      "Nitrogen", "", 
      "Argon", "", 
      "A, C, E", "Helium, Neon, dan Argon adalah gas mulia golongan VIIIA.", "KIM-01"
    ],
    [
      3, "Pilihan Ganda Kompleks", "L3", "Sejarah", "Pernyataan berikut yang benar mengenai Proklamasi adalah...", "", 
      "Dibaca di Jl. Pegangsaan Timur", "", 
      "Disusun oleh Soekarno-Hatta-Subardjo", "", 
      "Terjadi pada sore hari", "", 
      "Dihadiri oleh tentara Jepang secara resmi", "", 
      "", "", 
      "A, B", "Proklamasi dilakukan pagi hari dan tidak dihadiri resmi oleh Jepang.", "SEJ-01"
    ],
    [
      4, "Pilihan Ganda Kompleks (B/S)", "L2", "Astronomi", "Tentukan Benar (B) atau Salah (S) untuk pernyataan berikut:\n1. Matahari adalah bintang\n2. Bulan memancarkan cahaya sendiri\n3. Pluto adalah planet terkecil saat ini", "", 
      "Matahari adalah bintang", "", 
      "Bulan memancarkan cahaya sendiri", "", 
      "Pluto bukan planet utama", "", 
      "", "", 
      "", "", 
      "B, S, B", "Matahari bintang (B), Bulan pantulan (S), Pluto planet kerdil (B).", "AST-01"
    ],
    [
      5, "ISIAN", "L1", "Geografi", "Apa nama ibu kota negara Indonesia saat ini?", "", 
      "", "", 
      "", "", 
      "", "", 
      "", "", 
      "", "", 
      "Jakarta", "Ibu kota Indonesia saat ini adalah Jakarta.", "GEO-01"
    ],
    [
      6, "URAIAN", "L3", "Ekonomi", "Jelaskan dampak inflasi terhadap daya beli masyarakat!", "", 
      "", "", 
      "", "", 
      "", "", 
      "", "", 
      "", "", 
      "Inflasi menyebabkan harga barang naik, sehingga jumlah barang yang bisa dibeli dengan jumlah uang yang sama menjadi berkurang.", "Inflasi menurunkan nilai riil mata uang.", "EKO-01"
    ]
  ];
  
  const wsSoal = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
  XLSX.utils.book_append_sheet(wb, wsSoal, "Format Soal");

  // Sheet 2: Panduan
  const guide = [
    ["PANDUAN PENGISIAN TEMPLATE SOAL EDUCBT PRO"],
    [""],
    ["KOLOM", "INSTRUKSI PENGISIAN"],
    ["Tipe Soal", "Wajib isi: 'Pilihan Ganda', 'Pilihan Jamak (MCMA)', 'Pilihan Ganda Kompleks', 'Pilihan Ganda Kompleks (B/S)', 'ISIAN', atau 'URAIAN'"],
    ["Level", "Wajib isi: 'L1', 'L2', atau 'L3'"],
    ["Teks Soal", "Gunakan '\\n' untuk baris baru (Alt+Enter di Excel juga diperbolehkan)."],
    ["Gambar Soal (URL)", "Masukkan link/URL gambar langsung (akhiran .jpg, .png, .webp)."],
    [""],
    ["FORMAT KUNCI JAWABAN (SANGAT PENTING):"],
    ["1. Pilihan Ganda", "Gunakan satu huruf: A / B / C / D / E"],
    ["2. Pilihan Jamak / Kompleks", "Gunakan huruf dipisah koma: A, C, E"],
    ["3. Kompleks (B/S)", "Gunakan B atau S sesuai jumlah opsi pernyataan: B, S, B"],
    ["4. ISIAN", "Tuliskan jawaban singkat yang benar."],
    ["5. URAIAN", "Tuliskan poin-poin kunci jawaban atau penjelasan lengkap."],
    [""],
    ["TIPS", "Jangan menghapus Baris 1 (Header). Isian dan Uraian tidak memerlukan pengisian kolom Opsi."],
    ["PENTING", "Pastikan tidak ada baris kosong di tengah-tengah data soal."]
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guide);
  XLSX.utils.book_append_sheet(wb, wsGuide, "Panduan");

  XLSX.writeFile(wb, "Template_Soal_EduCBT_Pro_Lengkap.xlsx");
};

export const exportQuestionsToExcel = (questions: EduCBTQuestion[]) => {
  if (!questions || questions.length === 0) return;
  // @ts-ignore
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();

  const headers = [
    "No", "Tipe Soal", "Level", "Materi", "Teks Soal", "Gambar Soal (URL)",
    "Opsi A", "Gambar Opsi A (URL)", 
    "Opsi B", "Gambar Opsi B (URL)",
    "Opsi C", "Gambar Opsi C (URL)",
    "Opsi D", "Gambar Opsi D (URL)",
    "Opsi E", "Gambar Opsi E (URL)",
    "Kunci Jawaban", "Pembahasan", "Token Paket"
  ];

  const rows = questions.map((q, idx) => {
    let kunci = "";
    if (q.type === QuestionType.PilihanGanda) {
      if (typeof q.correctAnswer === 'number') {
        kunci = String.fromCharCode(65 + q.correctAnswer);
      }
    } else if (q.type === QuestionType.MCMA) {
      if (Array.isArray(q.correctAnswer)) {
        kunci = (q.correctAnswer as number[]).map(i => String.fromCharCode(65 + i)).join(", ");
      }
    } else if (q.type === QuestionType.Kompleks) {
      if (Array.isArray(q.correctAnswer)) {
        kunci = (q.correctAnswer as boolean[]).map((b, i) => b ? String.fromCharCode(65 + i) : null).filter(x => x).join(", ");
      }
    } else if (q.type === QuestionType.KompleksBS) {
      if (Array.isArray(q.correctAnswer)) {
        kunci = (q.correctAnswer as boolean[]).map(b => b ? 'B' : 'S').join(", ");
      }
    } else {
      kunci = String(q.correctAnswer || "");
    }

    return [
      q.order || (idx + 1),
      q.type,
      q.level,
      q.material || "",
      q.text || "",
      q.image || "",
      q.options[0] || "", q.optionImages?.[0] || "",
      q.options[1] || "", q.optionImages?.[1] || "",
      q.options[2] || "", q.optionImages?.[2] || "",
      q.options[3] || "", q.optionImages?.[3] || "",
      q.options[4] || "", q.optionImages?.[4] || "",
      kunci,
      q.explanation || "",
      q.quizToken || ""
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Daftar Soal");

  const safeSubject = (questions[0]?.subject || 'Export').toString().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
  XLSX.writeFile(wb, `Export_Soal_${safeSubject}_${Date.now()}.xlsx`);
};

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
                          <td style="border: 1px solid black; padding: 5px; text-align: center;">${i + 1}</td>
                          <td style="border: 1px solid black; padding: 5px;">${opt}</td>
                          <td style="border: 1px solid black; padding: 5px; text-align: center;"></td>
                          <td style="border: 1px solid black; padding: 5px; text-align: center;"></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : q.type === QuestionType.Isian || q.type === QuestionType.Uraian ? `
                  <div style="border: 1px solid #ccc; padding: 10px; min-height: 80px; margin-top: 10px; border-radius: 4px;">
                    <span style="color: #999; font-size: 10pt;">Jawaban: ....................................................................................................................................</span>
                  </div>
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
              } else {
                // Fix: Use String() constructor to safely handle cases where correctAnswer might be string, boolean, or inferred as never by TS
                key = String(q.correctAnswer ?? '-');
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
