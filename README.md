# Renkli Kum Bulmacası (Sandtrix Clone)

Bu proje, popüler fizik tabanlı tetris oyunu **Sandtrix**'in (diğer adıyla *Sandtris* veya *Setris*) modern, mobil uyumlu ve zengin görsel efektlere sahip bir klonudur. Oyun, düşen blokların yere değdiği an kuma dönüştüğü ve aynı renkteki kumların ekranın solundan sağına kesintisiz bir yol oluşturduğunda temizlendiği eğlenceli bir bulmaca mekaniğine sahiptir.

## 🌟 Özellikler

- ⏳ **Fizik Tabanlı Kum Stacking**: Hücresel otomat (cellular automata) algoritması ile kum taneleri yerçekimine göre dökülür ve doğal yığınlar oluşturur.
- 🔗 **Yol Bağlantısı Temizleme**: Geleneksel düz satır silme yerine, aynı renkteki kumların yan yana temas ederek sol duvardan sağ duvara kesintisiz bir bağlantı kurmasıyla erime gerçekleşir (Flood Fill bağlantı algoritması).
- 🔊 **Synthesizer Ses ve Müzik**: Web Audio API kullanılarak tamamen tarayıcıda anlık olarak sentezlenen retro synthwave müzikler ve ses efektleri (harici ses dosyası indirme gerektirmez).
- ⚡ **Güçlendiriciler (Power-ups)**:
  - 🌀 **Kasırga (Cyclone - 70 Elmas)**: Tahtada tıkladığınız bir alandaki tüm kumları 6 hücre yarıçapında yok eder ve boşluklar açar.
  - 🔄 **Şekil Değiştir (Swap - 50 Elmas)**: Mevcut aktif bloğu sıradaki ilk blokla değiştirerek stratejik avantaj sağlar.
- 💎 **Ekonomi ve Kayıt**: Hat silerek ve puan kazanarak elmas kazanın, elmaslarınızı güçlendiricilere harcayın. Yüksek skorlar ve elmaslar tarayıcı hafızasında (`localStorage`) saklanır.
- 📱 **Mobil Desteği**: Dokunmatik ekranlar için özel sanal joystick ve kontrol tuşları.

## 🛠️ Nasıl Çalıştırılır?

Bu oyun tamamen istemci taraflı (client-side) statik dosyalardan (HTML, CSS, JS) oluşmaktadır. Çalıştırmak için:

1. Bu depoyu indirin veya bilgisayarınıza klonlayın.
2. `index.html` dosyasına çift tıklayarak herhangi bir tarayıcıda doğrudan çalıştırın!
3. Alternatif olarak, bir geliştirme sunucusu açmak için terminalde:
   ```bash
   npx live-server
   # veya python ile:
   python -m http.server 8000
   ```

## 🎮 Kontroller

### Klavye
- **A / ← (Sol Ok)**: Bloğu sola kaydırır.
- **D / → (Sağ Ok)**: Bloğu sağa kaydırır.
- **W / ↑ (Yukarı Ok)**: Bloğu döndürür.
- **S / ↓ (Aşağı Ok)**: Yavaş aşağı bırakma.
- **Boşluk (Space)**: Bloğu doğrudan en alta düşürür (Hard Drop).
- **ESC / P**: Oyunu duraklatır.

### Güçlendiriciler
- Sol alttaki **🌀 Kasırga** butonuna tıkladıktan sonra oyun alanı içerisinde temizlemek istediğiniz bir bölgeye tıklayın.
- Ortadaki **🔄 Şekil Değiştir** butonuna tıklayarak sıradaki blok ile aktif bloğu takas edin.
- Sağdaki elmas panelindeki **+** butonuna tıklayarak hediye elmas kazanabilirsiniz.

## 🚀 GitHub Pages Üzerinde Yayınlama

Oyunu kendi GitHub profilinizde yayınlamak için aşağıdaki adımları takip edin:

1. GitHub'da `renkli-kum-bulmacasi` adında yeni bir boş depo (repository) oluşturun.
2. Bu projenin klasöründe git bağlantılarını kurup depoyu yükleyin:
   ```bash
   git init
   git remote add origin https://github.com/dmw2121/renkli-kum-bulmacasi.git
   git branch -M main
   git add .
   git commit -m "İlk sürüm: Renkli Kum Bulmacası tamamlandı"
   git push -u origin main
   ```
3. GitHub deponuzun ayarlarına (**Settings**) gidin.
4. Sol menüden **Pages** sekmesine tıklayın.
5. **Build and deployment** başlığı altında, **Source** kısmını *Deploy from a branch* olarak seçin.
6. **Branch** kısmından `main` (veya `/root` klasörü) seçin ve **Save** butonuna tıklayın.
7. Birkaç dakika içinde oyununuz `https://dmw2121.github.io/renkli-kum-bulmacasi/` adresinde yayına girecektir!
