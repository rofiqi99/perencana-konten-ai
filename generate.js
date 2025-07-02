// File: api/generate.js
// Ini adalah Serverless Function yang akan berjalan di Vercel.

// Menggunakan metode fetch bawaan
const fetch = require('node-fetch');

// Mengambil Kunci API dari Environment Variables yang aman di Vercel
const apiKeys = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter(Boolean); // Menyaring kunci yang mungkin kosong

// Handler utama untuk fungsi ini
module.exports = async (req, res) => {
  // Hanya izinkan metode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Cek jika tidak ada API key yang dikonfigurasi
  if (apiKeys.length === 0) {
    console.error("No API keys configured in Vercel environment.");
    return res.status(500).json({ error: "Konfigurasi Kunci API di server belum diatur." });
  }

  const { prompt, schema, isJson } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Permintaan harus menyertakan sebuah prompt." });
  }

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  };

  if (isJson && schema) {
    payload.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: schema,
    };
  }

  // Logika untuk mencoba setiap Kunci API
  let lastError = null;
  for (const apiKey of apiKeys) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    try {
      console.log(`Mencoba memanggil API dengan kunci...`);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Berhasil!`);
        return res.status(200).json({ result }); // Berhasil, kirim hasil
      }

      if (response.status === 429) {
        console.warn(`Kunci mencapai batas kuota. Mencoba kunci berikutnya...`);
        lastError = { status: 429, message: `Batas kuota untuk kunci saat ini tercapai.` };
        continue; // Lanjut ke kunci berikutnya
      }

      const errorBody = await response.json().catch(() => response.text());
      lastError = { status: response.status, message: `Gagal memanggil AI. Detail: ${JSON.stringify(errorBody)}` };
      break; // Hentikan jika error lain

    } catch (error) {
      console.error(`Terjadi kesalahan jaringan`, { errorMessage: error.message });
      lastError = { status: 500, message: `Kesalahan jaringan: ${error.message}` };
    }
  }

  console.error("Semua Kunci API gagal atau mencapai batas kuota.", { lastKnownError: lastError });
  return res.status(lastError?.status || 500).json({ error: lastError?.message || "Semua layanan AI sedang sibuk." });
};
