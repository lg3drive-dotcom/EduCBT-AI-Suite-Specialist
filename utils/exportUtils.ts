
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
    ],
    [
      4, "Pilihan Jamak (MCMA)", "L3", "Lingkungan", "Berikut yang termasuk gas rumah kaca adalah...", "", 
      "Karbon dioksida (CO2)", "Metana (CH4)", "Oksigen (O2)", "Nitrogen (N2)", "", 
      "A, B", "CO2 dan CH4 adalah penyebab utama efek rumah kaca.", "IPA-01"
    ]
  ];
  
  const wsSoal = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
  
  // Set column widths
  wsSoal['!cols'] = [
    { wch: 5 }, { wch: 22 }, { wch: 8 }, { wch: 15 }, { wch: 45 }, { wch: 15 },
    { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
    { wch: 18 }, { wch: 35 }, { wch: 15 }
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
                    <span style="font-size: 12px;">${opt}</span>
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
