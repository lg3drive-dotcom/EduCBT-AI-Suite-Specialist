
import { EduCBTQuestion, QuestionType } from "../types";

const EXCEL_COLUMNS = [
  "No", "ID", "Token", "Tipe Soal", "Level", "Mapel", "Fase", "Materi", 
  "Teks Soal", "Gambar Soal", 
  "Opsi A", "Gbr A", "Opsi B", "Gbr B", "Opsi C", "Gbr C", "Opsi D", "Gbr D", "Opsi E", "Gbr E",
  "Kunci Jawaban", "Label True", "Label False", "Pembahasan"
];

export const downloadExcelTemplate = () => {
  // @ts-ignore
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();

  const sampleData = [
    [
      1, "q_sample_01", "DFGBIN", "Pilihan Ganda", "C2 Memahami", "Bahasa Indonesia", "Fase C", "Makna Kata",
      "Apa makna denotatif dari 'Map'?", "https://i.ibb.co/example/stimulus.jpg",
      "Tempat menyimpan dokumen", "", "Peta lokasi", "", "Tas belanja", "", "Amplop", "", "", "",
      "A", "Benar", "Salah", "Map adalah penyimpan dokumen."
    ],
    [
      2, "q_sample_02", "DFGBIN", "(Benar/Salah)", "C4 Menganalisis", "Bahasa Indonesia", "Fase C", "Informasi Tersurat",
      "Tentukan benar atau salah pernyataan berikut:", "",
      "Vina anak yang rajin", "", "Vina pergi ke pasar", "", "Cuaca sangat dingin", "", "", "", "", "",
      "B, S, S", "Benar", "Salah", "Analisis berdasarkan teks paragraf 1."
    ],
    [
      3, "q_sample_03", "DFGBIN", "Pilihan Jamak (MCMA)", "C2 Memahami", "Bahasa Indonesia", "Fase C", "Makna Konotatif",
      "Apa makna 'Kepala Dingin'?", "",
      "Sabar", "", "Tenang", "", "Pemarah", "", "", "", "", "",
      "A, B", "Sesuai", "Tidak Sesuai", "Kepala dingin artinya tenang."
    ]
  ];
  
  const wsSoal = XLSX.utils.aoa_to_sheet([EXCEL_COLUMNS, ...sampleData]);
  
  wsSoal['!cols'] = EXCEL_COLUMNS.map(() => ({ wch: 15 }));
  wsSoal['!cols'][8] = { wch: 40 }; // Teks Soal lebih lebar
  wsSoal['!cols'][23] = { wch: 30 }; // Pembahasan lebih lebar

  XLSX.utils.book_append_sheet(wb, wsSoal, "Format Import");
  XLSX.writeFile(wb, "Template_EduCBT_Lengkap.xlsx");
};

export const exportQuestionsToExcel = (questions: EduCBTQuestion[]) => {
  if (!questions.length) return;
  // @ts-ignore
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();

  const rows = questions.map((q) => {
    let kunci = "";
    if (q.type === QuestionType.PilihanGanda) {
      kunci = String.fromCharCode(65 + Number(q.correctAnswer));
    } else if (q.type === QuestionType.MCMA) {
      kunci = (q.correctAnswer as number[]).map(i => String.fromCharCode(65+i)).join(", ");
    } else if (q.type === QuestionType.BenarSalah || q.type === QuestionType.SesuaiTidakSesuai) {
      const labels = q.type === QuestionType.BenarSalah ? ['B', 'S'] : ['Sesuai', 'T.Sesuai'];
      kunci = (q.correctAnswer as boolean[]).map(b => b ? labels[0] : labels[1]).join(", ");
    } else {
      kunci = String(q.correctAnswer);
    }

    const optImgs = q.optionImages || [];

    return [
      q.order,
      q.id,
      q.quizToken,
      q.type,
      q.level,
      q.subject,
      q.phase,
      q.material,
      q.text,
      q.image || "",
      q.options[0] || "", optImgs[0] || "",
      q.options[1] || "", optImgs[1] || "",
      q.options[2] || "", optImgs[2] || "",
      q.options[3] || "", optImgs[3] || "",
      q.options[4] || "", optImgs[4] || "",
      kunci,
      q.tfLabels?.true || "",
      q.tfLabels?.false || "",
      q.explanation
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([EXCEL_COLUMNS, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Soal");
  XLSX.writeFile(wb, `Export_Soal_${questions[0].quizToken}.xlsx`);
};

const getSoalHtml = (questions: EduCBTQuestion[]) => {
  return `
    <div style="font-family: 'Inter', sans-serif; padding: 40px; color: black; line-height: 1.6; width: 720px; margin: auto;">
      <h1 style="text-align: center; margin-bottom: 5px; font-size: 20px; font-weight: bold;">NASKAH SOAL EVALUASI</h1>
      <p style="text-align: center; margin-bottom: 20px; font-size: 12px; text-transform: uppercase; font-weight: bold; color: #444;">Sistem EduCBT AI Suite</p>
      <hr style="border: 1px solid black; margin-bottom: 30px;" />
      
      ${questions.map((q, i) => {
        const isTable = q.type === QuestionType.BenarSalah || q.type === QuestionType.SesuaiTidakSesuai;
        const isMCMA = q.type === QuestionType.MCMA;
        
        return `
          <div style="margin-bottom: 35px; page-break-inside: avoid;">
            <div style="display: flex; gap: 12px;">
              <strong style="min-width: 20px;">${i+1}.</strong> 
              <div style="flex: 1;">
                <div style="margin-bottom: 8px;">${q.text}</div>
                ${isMCMA ? `<p style="font-size: 10px; font-weight: bold; color: #666; font-style: italic; margin-bottom: 12px;">(Pilih lebih dari satu jawaban yang benar)</p>` : ''}
                ${q.image ? `<div style="margin: 15px 0;"><img src="${q.image}" style="max-width: 100%; max-height: 300px; height: auto; border: 1px solid #eee; border-radius: 8px;" /></div>` : ''}
              </div>
            </div>

            ${isTable ? `
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-left: 32px;">
                <tr style="background: #f8fafc;">
                  <th style="border: 1px solid #ccc; padding: 10px; font-size: 11px; text-align: left; text-transform: uppercase;">Pernyataan</th>
                  <th style="border: 1px solid #ccc; padding: 10px; width: 85px; font-size: 11px; text-align: center;">${q.tfLabels?.true}</th>
                  <th style="border: 1px solid #ccc; padding: 10px; width: 85px; font-size: 11px; text-align: center;">${q.tfLabels?.false}</th>
                </tr>
                ${q.options.map(opt => `
                  <tr>
                    <td style="border: 1px solid #ccc; padding: 10px; font-size: 12px;">${opt}</td>
                    <td style="border: 1px solid #ccc; padding: 10px; text-align: center;"><div style="width: 14px; height: 14px; border: 1px solid #999; margin: auto; border-radius: 3px;"></div></td>
                    <td style="border: 1px solid #ccc; padding: 10px; text-align: center;"><div style="width: 14px; height: 14px; border: 1px solid #999; margin: auto; border-radius: 3px;"></div></td>
                  </tr>
                `).join('')}
              </table>
            ` : (q.options.length > 0 ? `
              <div style="margin-top: 10px; margin-left: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                ${q.options.map((opt, oIdx) => `
                  <div style="display: flex; gap: 10px; align-items: flex-start; margin-bottom: 5px;">
                    ${isMCMA ? 
                      `<div style="min-width: 16px; height: 16px; border: 1.5px solid #000; border-radius: 3px; margin-top: 2px;"></div>` : 
                      `<span style="min-width: 20px; font-weight: bold;">${String.fromCharCode(65+oIdx)}.</span>`
                    }
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <span style="font-size: 12px;">${opt}</span>
                      ${q.optionImages?.[oIdx] ? `<img src="${q.optionImages[oIdx]}" style="max-width: 120px; border-radius: 4px;" />` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : '')}
          </div>
        `;
      }).join('')}
    </div>
  `;
};

export const downloadSoalPdf = async (questions: EduCBTQuestion[]) => {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.innerHTML = getSoalHtml(questions);
  document.body.appendChild(container);
  
  try {
    // @ts-ignore
    const canvas = await window.html2canvas(container, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    // @ts-ignore
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Naskah_Soal_${Date.now()}.pdf`);
  } catch (err) {
    console.error(err);
    alert("Gagal mengunduh PDF.");
  } finally {
    document.body.removeChild(container);
  }
};
