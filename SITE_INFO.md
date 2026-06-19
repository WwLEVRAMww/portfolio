# Портфолио Андронов Роман — Полная документация

## Общая информация

- **Файл сайта**: `index.html` (один файл, весь HTML/CSS/JS)
- **Репозиторий**: `https://github.com/WwLEVRAMww/portfolio.git`
- **GitHub Pages**: `https://wwlevramww.github.io/portfolio/`
- **Владелец**: Андронов Роман
- **Город**: Москва / Петербург
- **Telegram**: `https://t.me/wwLEVRAMww`

---

## API ключи и конфигурация

### Google Drive API

- **API ключ**: `AIzaSyBz98xF6vEsgjpf53yTM8zuttlMJRxwbes`
- **Ограничения ключа**: Google Drive API (в настройках ключа выбран Drive API)
- **Drive API v3 endpoint**: `https://www.googleapis.com/drive/v3/files`
- **ID папки с фото**: `1_zVX9cm_s9vXdny7Ipsc2rsigGwcXZIG`
- **Доступ**: папка расшарена на "Редактор" (или "Все, у кого есть ссылка" → Читатель)
- **Лимит**: 100 файлов на запрос (`pageSize=100`)

### QR-код Telegram

- **Сервис**: `https://api.qrserver.com/v1/create-qr-code/`
- **Параметры**: `size=200x200&color=111114&data=<URL>`
- **Генерируется динамически** из `cfg.telegramLink`

---

## Структура Google Drive

```
📁 1_zVX9cm_s9vXdny7Ipsc2rsigGwcXZIG (корень)
├── 📁 Подпапка1/          ← пакет работ 01
│   ├── photo1.jpg
│   ├── photo2.jpg
│   └── ...
├── 📁 Подпапка2/          ← пакет работ 02
│   └── ...
├── 📁 _assets/            ← пропускается (начинается с _)
│   └── hero.jpg
├── photo_root1.jpg        ← если нет подпапок, всё = один пакет
└── photo_root2.jpg
```

- Папки с `_` в начале имени **пропускаются** (не показываются как пакеты)
- Если подпапок нет — все фото корня = один пакет "Портфолио"
- Фото в папках сортируются по имени
- **Превью пакета**: первое фото в папке
- **Формат URL фото**: `https://lh3.googleusercontent.com/d/{FILE_ID}`

---

## Как работает загрузка фото

1. Запрос к Drive API: `GET /drive/v3/files?q='{folderId}' in parents and mimeType='application/vnd.google-apps.folder'`
2. Для каждой подпапки: запрос фото `mimeType contains 'image/'`
3. Если подпапок нет — запрашиваются все изображения из корня
4. Каждое фото отображается через `https://lh3.googleusercontent.com/d/{id}`
5. CORS работает — Google Drive API возвращает `access-control-allow-origin`

---

## Функционал сайта

### Блоки (по порядку)

1. **Hero** — полноэкранная секция с фото и именем
2. **Карусель хайлайтов** — автоматическая смена фото пакетов (5 сек), swipe кнопки
3. **Портфолио** — карточки пакетов 5:6, face detection для позиционирования превью
4. **Тарифы** — 3 карточки (Classic/Creative/Business)
5. **Бронирование** — кнопка Telegram + QR-код
6. **Футер** — копирайт

### Face Detection

- **Библиотека**: `@vladmandic/face-api` v1.7.12 с jsdelivr CDN
- **CDN URL**: `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js`
- **Модели**: tinyFaceDetector + faceLandmark68Tiny
- **URL моделей**: `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/`
- **Логика**: находит верхнюю лендмарку лица, ставит её на 6% от верха карточки
- **Требование**: `crossorigin="anonymous"` на тегах `<img>`

### WebGL Lava Background

- **Технология**: WebGL fragment shader
- **Анимация**: только при скролле страницы, по инерции затихает
- **Цвета**: `#420000` → `#b73a01` → `#ffb395` (темно-красный → оранжевый → розовый)
- **Шейдер**: double domain warping fbm noise, 4 октавы

### Lightbox (просмотр пакета)

- Открывается кликом на карточку пакета
- Сетка фото с zoom по клику
- Навигация: ← → клавиатуры, swipe на мобильных
- Закрытие: клавиша Escape, клик по фону, кнопка X

---

## Структура CONFIG в index.html

```javascript
const CONFIG = {
  ownerName: "Андронов Роман",
  telegramLink: "https://t.me/wwLEVRAMww",
  driveFolderId: "1_zVX9cm_s9vXdny7Ipsc2rsigGwcXZIG",
  driveApiKey: "AIzaSyBz98xF6vEsgjpf53yTM8zuttlMJRxwbes",
  pricing: [
    { tag: "Classic", name: "Portrait", price: "12 000 ₽", duration: "1.5–2 часа", desc: "...", features: [...] },
    { tag: "Creative", name: "Editorial", price: "20 000 ₽", duration: "3–4 часа", desc: "...", features: [...] },
    { tag: "Business", name: "Commercial", price: "По запросу", duration: "Full Day", desc: "...", features: [...] }
  ],
  mockPacks: [...], // используется когда driveApiKey пустой
};
```

---

## Деплой

1. `git push` в `main` ветку
2. GitHub Pages автоматически деплоит с `main`
3. URL: `https://wwlevramww.github.io/portfolio/`

### GitHub Token (для пуша)

- Используется токен с `repo` scope
- Формат в remote: `https://<token>@github.com/WwLEVRAMww/portfolio.git`

---

## Стиль и дизайн

- **Шрифты**: Jost (заголовки), Cormorant Garamond (имена), Inter (текст)
- **Цвета**: тёмный фон, оранжевая лава, стеклянные карточки
- **Glass morphism**: `backdrop-filter: blur()`, полупрозрачные фоны
- **Скругления**: 16px для карточек, 20px для page-frame
- **Адаптивность**: grid breakpoints на 1024px, 768px, 640px

---

## Контакты

- **Telegram**: `https://t.me/wwLEVRAMww`
- **Все ссылки на Telegram ведут на этот адрес**
