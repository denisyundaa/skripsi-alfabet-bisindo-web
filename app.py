import base64
import cv2
import numpy as np
import mediapipe as mp
import pickle
from flask import Flask, render_template
from flask_socketio import SocketIO, emit
from threading import Lock

# Inisialisasi Server
app = Flask(__name__)
# Menonaktifkan batasan CORS agar klien lokal dapat berkomunikasi dengan lancar
socketio = SocketIO(app, cors_allowed_origins="*")
lock = Lock()

print("Memuat Model Random Forest ke dalam memori...")
with open('model_rf.pkl', 'rb') as f:
    model_rf = pickle.load(f)

print("Menginisialisasi MediaPipe Hands...")
mp_hands = mp.solutions.hands
# Parameter disamakan dengan tahap pembuatan CSV untuk konsistensi ekstraksi
hands = mp_hands.Hands(
    static_image_mode=True, 
    max_num_hands=1,
    min_detection_confidence=0.51
)

# Routing UI
@app.route('/')
def beranda():
    return render_template('beranda.html')

@app.route('/panduan')
def panduan():
    return render_template('bacapanduan.html')

@app.route('/praktik')
def praktik():
    return render_template('praktikalfabet.html')

@app.route('/selesai')
def selesai():
    return render_template('selesaibelajar.html')

# Komunikasi Asinkron dan Prediksi Real-Time
@socketio.on('image_frame')
def handle_frame(data):
    try:
        # Dekode format Base64 dari klien menjadi data byte
        encoded_data = data.split(',')[1]
        decoded_data = base64.b64decode(encoded_data)
        
        # Konversi byte menjadi matriks array citra (NumPy) untuk OpenCV
        np_data = np.frombuffer(decoded_data, np.uint8)
        frame = cv2.imdecode(np_data, cv2.IMREAD_COLOR)
        
        # Konversi BGR ke RGB untuk MediaPipe
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # --- TAMBAHKAN KUNCI ANTREAN (WITH LOCK) DI SINI ---
        with lock:
            results = hands.process(img_rgb)
        # ---------------------------------------------------
            
        prediksi_huruf = ""
        
        # Jika tangan terdeteksi, lakukan ekstraksi fitur dan prediksi
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                landmark_row = []
                
                # Ekstraksi 63 koordinat spasial spasial (21 titik * 3 sumbu)
                for lm in hand_landmarks.landmark:
                    landmark_row.extend([lm.x, lm.y, lm.z])
                
                # Prediksi array spasial 1D menggunakan Random Forest
                hasil_prediksi = model_rf.predict([landmark_row])[0]
                
                # Membalikkan Label Encoding (Indeks 0-25 -> ASCII 65-90 -> Huruf A-Z)
                prediksi_huruf = chr(hasil_prediksi + 65)
                
        # Pancarkan hasil prediksi kembali ke antarmuka klien
        emit('prediksi_result', {'huruf': prediksi_huruf})
        
    except Exception as e:
        print(f"Terjadi kesalahan saat memproses frame: {e}")

if __name__ == '__main__':
    print("Server Flask berjalan. Akses melalui: http://127.0.0.1:5000")
    # Menjalankan server menggunakan instance SocketIO
    socketio.run(app, debug=True)