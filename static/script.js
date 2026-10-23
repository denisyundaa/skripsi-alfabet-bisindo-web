// ==========================================
// 1. Inisialisasi Variabel dan Elemen DOM
// ==========================================
const socket = io();

const videoElement = document.createElement('video');
const canvasElement = document.createElement('canvas');
const context = canvasElement.getContext('2d');
const kameraFeed = document.querySelector('.kamera-feed');
const hurufTerdeteksi = document.getElementById('huruf-terdeteksi');

const targetHurufEl = document.querySelector('.target-huruf');
const gambarReferensi = document.querySelector('.gambar-referensi');
const ikonCentang = document.querySelector('.ikon-centang');
const teksValidasi = document.querySelector('.teks-validasi');
const btnSekunder = document.querySelector('.btn-sekunder');
const btnUtamaKecil = document.querySelector('.btn-utama-kecil');
const tombolAbjad = document.querySelectorAll('.abjad-btn');

const daftarHuruf = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// BACA LOCAL STORAGE: Cek apakah ada progres yang tersimpan sebelumnya
let progresTersimpan = localStorage.getItem('progres_bisindo');
// Jika ada, jadikan angka. Jika belum ada (baru pertama kali buka), mulai dari 0 (Huruf A)
let indeksSaatIni = progresTersimpan ? parseInt(progresTersimpan) : 0; 

let targetSaatIni = daftarHuruf[indeksSaatIni];
let deteksiAktif = true;

// ==========================================
// 2. Fungsi Manajemen UI & Perkembangan
// ==========================================

function updateUI() {
    targetSaatIni = daftarHuruf[indeksSaatIni];
    targetHurufEl.innerText = targetSaatIni;
    
    gambarReferensi.src = `/static/aset-gambar/signs/${targetSaatIni}.png`;
    
    ikonCentang.style.display = 'none';
    teksValidasi.style.display = 'none';
    btnUtamaKecil.style.display = 'none';
    
    tombolAbjad.forEach((btn, index) => {
        if (index === indeksSaatIni) {
            btn.classList.add('active'); 
        } else if (index < indeksSaatIni) {
            btn.classList.add('completed'); 
            btn.classList.remove('active');
        } else {
            btn.classList.remove('active', 'completed');
        }
    });

    deteksiAktif = true;
}

// Event Listener Tombol "Huruf Selanjutnya" / "Selesai Belajar"
btnUtamaKecil.addEventListener('click', () => {
    if (indeksSaatIni < daftarHuruf.length - 1) {
        indeksSaatIni++;
        
        // SIMPAN LOCAL STORAGE: Catat progres terbaru ke dalam browser
        localStorage.setItem('progres_bisindo', indeksSaatIni);
        
        updateUI();
    } else {
        window.location.href = "/selesai";
    }
});

// Event Listener Tombol "Reset Huruf Saat Ini"
btnSekunder.addEventListener('click', () => {
    deteksiAktif = false;
    hurufTerdeteksi.innerText = "-";
    updateUI();
});


// ==========================================
// 3. Fungsi Kamera dan WebSocket
// ==========================================

// Meminta izin dan menyalakan webcam
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });
        
        videoElement.srcObject = stream;
        videoElement.play();
        
        kameraFeed.innerHTML = '';
        kameraFeed.appendChild(videoElement);
        videoElement.style.width = '100%';
        videoElement.style.borderRadius = '12px';
        videoElement.style.objectFit = 'cover';

        setInterval(sendFrame, 250);
        updateUI(); // Inisialisasi UI pertama kali (Huruf A)
        
    } catch (error) {
        console.error("Error:", error);
        kameraFeed.innerHTML = '<p style="color: red;">Gagal mengakses kamera.</p>';
    }
}

// Menangkap gambar dan mengirimnya ke server
function sendFrame() {
    // Hanya kirim jika deteksi sedang aktif (belum menekan tombol lanjut)
    if (deteksiAktif && videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
        
        const dataURL = canvasElement.toDataURL('image/jpeg', 0.5);
        socket.emit('image_frame', dataURL);
    }
}

// Menangkap balasan dari server (model_rf.pkl)
socket.on('prediksi_result', function(data) {
    if (deteksiAktif && data.huruf) {
        hurufTerdeteksi.innerText = data.huruf;
        
        // LOGIKA VALIDASI UTAMA: Jika tebakan AI sama dengan target (misal A == A)
        if (data.huruf === targetSaatIni) {
            // Tampilkan centang "Praktik Benar"
            ikonCentang.style.display = 'inline-block';
            teksValidasi.style.display = 'inline-block';
            
            // Tampilkan tombol Lanjut/Selesai
            btnUtamaKecil.style.display = 'inline-block';
            
            // Ubah teks tombol jika sudah di huruf Z
            if (indeksSaatIni === daftarHuruf.length - 1) {
                btnUtamaKecil.innerText = "Selesai Belajar";
            } else {
                btnUtamaKecil.innerText = "Huruf Selanjutnya";
            }
            
            // Hentikan deteksi sementara agar centang tidak hilang-hilang
            deteksiAktif = false;
        }
    }
});

// Menjalankan sistem saat web dimuat
window.addEventListener('load', setupCamera);