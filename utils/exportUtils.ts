
import { EduCBTQuestion, QuestionType } from "../types";

export const downloadExcelTemplate = () => {
  // @ts-ignore
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();

  const headers = [
    [
      "No", "Tipe Soal", "Level", "Materi", "Teks Soal", "Gambar Soal (URL)",
      "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Opsi E",
      "Kunci Jawaban", "Pembahasan", "Token Paket"
    ]
  ];
  
  const sampleData = [
    [
      1, "Pilihan Ganda", "L1", "Tata Surya", "Planet terdekat dari Matahari adalah...", "", 
      "Merkurius", "Venus", "Bumi", "Mars", "Jupiter", 
      "A", "Merkurius adalah planet pertama.", "IPA-01"
    ],
    [
      2, "(Benar/Salah)", "L2", "Sains", "Pernyataan Mengenai Tata Surya:", "", 
      "Matahari adalah planet", "Bumi memiliki 1 satelit alami", "Pluto adalah planet terbesar", "", "", 
      "S, B, S", "Matahari bintang, Bulan satelit Bumi, Pluto kerdil.", "IPA-01"
    ],
    [
      3, "(Sesuai/Tidak Sesuai)", "L2", "Bahasa", "Dampak Perubahan Iklim:", "", 
      "Meningkatnya permukaan laut", "Berlangsung sangat cepat", "Hanya terjadi di kutub", "", "", 
      "SESUAI, SESUAI, TIDAK SESUAI", "Iklim berubah global.", "IND-01"
    ]
  ];
  
  const wsSoal = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
  
  // Set column widths
  wsSoal['!cols'] = [
    { wch: 5 }, { wch: 20 }, { wch: 8 }, { wch: 15 }, { wch: 40 }, { wch: 15 },
    { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
    { wch: 15 }, { wch: 30 }, { wch: 15 }
  ];

  XLSX.utils.book_append_sheet(wb, wsSoal, "Format Import");
  XLSX.writeFile(wb, "Template_Import_EduCBT.xlsx");
};

export const exportQuestionsToExcel = (questions: EduCBTQuestion[]) => {
  if (!questions.length) return;
  // @ts-ignore
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();

  const rows = questions.map((q) => {
    let kunci = "";
    if (q.type === QuestionType.PilihanGanda) kunci = String.fromCharCode(65 + Number(q.correctAnswer));
    else if (q.type === QuestionType.MCMA) kunci = (q.correctAnswer as number[]).map(i => String.fromCharCode(65+i)).join(", ");
    else if (q.type === QuestionType.BenarSalah || q.type === QuestionType.SesuaiTidakSesuai) {
      const labels = q.type === QuestionType.BenarSalah ? ['B', 'S'] : ['Sesuai', 'Tidak Sesuai'];
      kunci = (q.correctAnswer as boolean[]).map(b => b ? labels[0] : labels[1]).join(", ");
    }
    else kunci = String(q.correctAnswer);

    return [
      q.order, q.type, q.level, q.material, q.text, q.image || "",
      q.options[0] || "", q.options[1] || "", q.options[2] || "", q.options[3] || "", q.options[4] || "",
      kunci, q.explanation, q.quizToken
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([["No", "Tipe", "Level", "Materi", "Soal", "Img", "A", "B", "C", "D", "E", "Kunci", "Pembahasan", "Token"], ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Soal");
  XLSX.writeFile(wb, "Export_Soal.xlsx");
};

const getSoalHtml = (questions: EduCBTQuestion[]) => {
  return `
    <div style="font-family: serif; padding: 40px; color: black; line-height: 1.5; width: 680px; margin: auto;">
      <h1 style="text-align: center; margin-bottom: 20px; font-size: 24px;">NASKAH SOAL EVALUASI</h1>
      <hr style="border: 1px solid black; margin-bottom: 30px;" />
      ${questions.map((q, i) => {
        const isTable = q.type === QuestionType.BenarSalah || q.type === QuestionType.SesuaiTidakSesuai;
        return `
          <div style="margin-bottom: 30px; page-break-inside: avoid;">
            <div style="display: flex; gap: 10px;">
              <strong>${i+1}.</strong> 
              <div style="flex: 1;">
                ${q.text}
                ${q.image ? `<div style="margin: 15px 0;"><img src="${q.image}" style="max-width: 100%; height: auto; border: 1px solid #ddd;" /></div>` : ''}
              </div>
            </div>
            ${isTable ? `
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-left: 25px;">
                <tr style="background: #f3f4f6;">
                  <th style="border: 1px solid #000; padding: 8px; font-size: 12px; text-align: left;">Pernyataan</th>
                  <th style="border: 1px solid #000; padding: 8px; width: 80px; font-size: 12px; text-align: center;">${q.tfLabels?.true}</th>
                  <th style="border: 1px solid #000; padding: 8px; width: 80px; font-size: 12px; text-align: center;">${q.tfLabels?.false}</th>
                </tr>
                ${q.options.map(opt => `
                  <tr>
                    <td style="border: 1px solid #000; padding: 8px; font-size: 12px;">${opt}</td>
                    <td style="border: 1px solid #000; padding: 8px;"></td>
                    <td style="border: 1px solid #000; padding: 8px;"></td>
                  </tr>
                `).join('')}
              </table>
            ` : (q.options.length > 0 ? `
              <div style="margin-top: 15px; margin-left: 25px;">
                ${q.options.map((opt, oIdx) => `
                  <div style="margin-bottom: 5px; display: flex; gap: 10px;">
                    <span style="min-width: 20px;">${String.fromCharCode(65+oIdx)}.</span>
                    <span>${opt}</span>
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

export const downloadKisiKisiPdf = () => {};
export const downloadSoalDoc = () => {};
export const downloadKisiKisiDoc = () => {};
