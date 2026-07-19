/**
 * i18n dictionaries.
 *
 * 20 languages are exposed in the switcher. Five (en, es, fr, de, ar) ship with
 * full UI translations; the rest are scaffolded and fall back to English until
 * professionally translated (do NOT machine-translate production copy). RTL is
 * handled for Arabic / Hebrew / Persian.
 */

export type Lang =
  | "en" | "es" | "fr" | "de" | "ar" | "zh" | "ja" | "hi" | "pt" | "ru"
  | "it" | "ko" | "nl" | "tr" | "pl" | "sv" | "he" | "fa" | "id" | "uk";

export interface LangMeta { code: Lang; name: string; native: string; rtl?: boolean; full?: boolean; draft?: boolean }

export const LANGUAGES: LangMeta[] = [
  { code: "en", name: "English", native: "English", full: true },
  { code: "es", name: "Spanish", native: "Español", full: true },
  { code: "fr", name: "French", native: "Français", full: true },
  { code: "de", name: "German", native: "Deutsch", full: true },
  { code: "ar", name: "Arabic", native: "العربية", rtl: true, full: true },
  { code: "zh", name: "Chinese", native: "中文", draft: true },
  { code: "ja", name: "Japanese", native: "日本語", draft: true },
  { code: "hi", name: "Hindi", native: "हिन्दी", draft: true },
  { code: "pt", name: "Portuguese", native: "Português", full: true },
  { code: "ru", name: "Russian", native: "Русский", draft: true },
  { code: "it", name: "Italian", native: "Italiano", full: true },
  { code: "ko", name: "Korean", native: "한국어", draft: true },
  { code: "nl", name: "Dutch", native: "Nederlands", draft: true },
  { code: "tr", name: "Turkish", native: "Türkçe", draft: true },
  { code: "pl", name: "Polish", native: "Polski", draft: true },
  { code: "sv", name: "Swedish", native: "Svenska", draft: true },
  { code: "he", name: "Hebrew", native: "עברית", rtl: true, draft: true },
  { code: "fa", name: "Persian", native: "فارسی", rtl: true, draft: true },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia", draft: true },
  { code: "uk", name: "Ukrainian", native: "Українська", draft: true },
];

export type Dict = Record<string, string>;

const en: Dict = {
  "app.name": "ORIGENTRA",
  "app.tag": "Trusted Control Plane",
  "nav.overview": "Overview",
  "nav.analytics": "Analytics",
  "nav.identity": "Identity",
  "nav.provenance": "Provenance",
  "nav.abuse": "Abuse Signals",
  "nav.settings": "Settings",
  "nav.profile": "Profile",
  "section.traffic": "Live Traffic",
  "section.dataflow": "Data Flow",
  "section.events": "Event Stream",
  "section.weather": "7-Day Forecast",
  "section.clock": "World Clock",
  "section.markets": "Markets",
  "section.news": "Intelligence Feed",
  "kpi.validity": "Passport Validity",
  "kpi.throughput": "Throughput",
  "kpi.latency": "Median Latency",
  "kpi.blocked": "Blocked / Fail-Closed",
  "label.live": "LIVE",
  "label.now": "NOW",
  "label.theme": "Theme",
  "label.language": "Language",
  "label.sound": "Sound",
  "label.system": "System",
  "label.operational": "All systems operational",
  "action.search": "Search…",
};

const es: Dict = {
  "app.tag": "Plano de Control de Confianza",
  "nav.overview": "Resumen", "nav.analytics": "Analítica", "nav.identity": "Identidad",
  "nav.provenance": "Procedencia", "nav.abuse": "Señales de Abuso", "nav.settings": "Ajustes", "nav.profile": "Perfil",
  "section.traffic": "Tráfico en Vivo", "section.dataflow": "Flujo de Datos", "section.events": "Flujo de Eventos",
  "section.weather": "Pronóstico 7 Días", "section.clock": "Reloj Mundial", "section.markets": "Mercados", "section.news": "Feed de Inteligencia",
  "kpi.validity": "Validez de Pasaporte", "kpi.throughput": "Rendimiento", "kpi.latency": "Latencia Media", "kpi.blocked": "Bloqueado / Cierre Seguro",
  "label.live": "EN VIVO", "label.now": "AHORA", "label.theme": "Tema", "label.language": "Idioma", "label.sound": "Sonido",
  "label.system": "Sistema", "label.operational": "Todos los sistemas operativos", "action.search": "Buscar…",
};

const fr: Dict = {
  "app.tag": "Plan de Contrôle de Confiance",
  "nav.overview": "Aperçu", "nav.analytics": "Analytique", "nav.identity": "Identité",
  "nav.provenance": "Provenance", "nav.abuse": "Signaux d'Abus", "nav.settings": "Paramètres", "nav.profile": "Profil",
  "section.traffic": "Trafic en Direct", "section.dataflow": "Flux de Données", "section.events": "Flux d'Événements",
  "section.weather": "Prévisions 7 Jours", "section.clock": "Horloge Mondiale", "section.markets": "Marchés", "section.news": "Flux de Renseignement",
  "kpi.validity": "Validité du Passeport", "kpi.throughput": "Débit", "kpi.latency": "Latence Médiane", "kpi.blocked": "Bloqué / Sécurisé",
  "label.live": "EN DIRECT", "label.now": "MAINTENANT", "label.theme": "Thème", "label.language": "Langue", "label.sound": "Son",
  "label.system": "Système", "label.operational": "Tous les systèmes opérationnels", "action.search": "Rechercher…",
};

const de: Dict = {
  "app.tag": "Vertrauens-Kontrollebene",
  "nav.overview": "Übersicht", "nav.analytics": "Analytik", "nav.identity": "Identität",
  "nav.provenance": "Herkunft", "nav.abuse": "Missbrauchssignale", "nav.settings": "Einstellungen", "nav.profile": "Profil",
  "section.traffic": "Live-Verkehr", "section.dataflow": "Datenfluss", "section.events": "Ereignis-Stream",
  "section.weather": "7-Tage-Vorhersage", "section.clock": "Weltuhr", "section.markets": "Märkte", "section.news": "Informations-Feed",
  "kpi.validity": "Pass-Gültigkeit", "kpi.throughput": "Durchsatz", "kpi.latency": "Mittlere Latenz", "kpi.blocked": "Blockiert / Fail-Closed",
  "label.live": "LIVE", "label.now": "JETZT", "label.theme": "Thema", "label.language": "Sprache", "label.sound": "Ton",
  "label.system": "System", "label.operational": "Alle Systeme betriebsbereit", "action.search": "Suchen…",
};

const ar: Dict = {
  "app.tag": "مستوى التحكم الموثوق",
  "nav.overview": "نظرة عامة", "nav.analytics": "تحليلات", "nav.identity": "الهوية",
  "nav.provenance": "المصدر", "nav.abuse": "إشارات الإساءة", "nav.settings": "الإعدادات", "nav.profile": "الملف الشخصي",
  "section.traffic": "حركة مباشرة", "section.dataflow": "تدفق البيانات", "section.events": "تدفق الأحداث",
  "section.weather": "توقعات ٧ أيام", "section.clock": "الساعة العالمية", "section.markets": "الأسواق", "section.news": "موجز الاستخبارات",
  "kpi.validity": "صلاحية الجواز", "kpi.throughput": "الإنتاجية", "kpi.latency": "زمن الاستجابة الوسيط", "kpi.blocked": "محظور / فشل آمن",
  "label.live": "مباشر", "label.now": "الآن", "label.theme": "السمة", "label.language": "اللغة", "label.sound": "الصوت",
  "label.system": "النظام", "label.operational": "جميع الأنظمة تعمل", "action.search": "بحث…",
};

const pt: Dict = {
  "app.tag": "Plano de Controlo de Confiança",
  "nav.overview": "Visão Geral", "nav.analytics": "Análise", "nav.identity": "Identidade",
  "nav.provenance": "Proveniência", "nav.abuse": "Sinais de Abuso", "nav.settings": "Definições", "nav.profile": "Perfil",
  "section.traffic": "Tráfego ao Vivo", "section.dataflow": "Fluxo de Dados", "section.events": "Fluxo de Eventos",
  "section.weather": "Previsão 7 Dias", "section.clock": "Relógio Mundial", "section.markets": "Mercados", "section.news": "Feed de Inteligência",
  "kpi.validity": "Validade do Passaporte", "kpi.throughput": "Taxa", "kpi.latency": "Latência Média", "kpi.blocked": "Bloqueado / Falha Segura",
  "label.live": "AO VIVO", "label.now": "AGORA", "label.theme": "Tema", "label.language": "Idioma", "label.sound": "Som",
  "label.system": "Sistema", "label.operational": "Todos os sistemas operacionais", "action.search": "Pesquisar…",
};

const it: Dict = {
  "app.tag": "Piano di Controllo Affidabile",
  "nav.overview": "Panoramica", "nav.analytics": "Analisi", "nav.identity": "Identità",
  "nav.provenance": "Provenienza", "nav.abuse": "Segnali di Abuso", "nav.settings": "Impostazioni", "nav.profile": "Profilo",
  "section.traffic": "Traffico Live", "section.dataflow": "Flusso di Dati", "section.events": "Flusso Eventi",
  "section.weather": "Previsioni 7 Giorni", "section.clock": "Orologio Mondiale", "section.markets": "Mercati", "section.news": "Feed di Intelligence",
  "kpi.validity": "Validità Passaporto", "kpi.throughput": "Portata", "kpi.latency": "Latenza Mediana", "kpi.blocked": "Bloccato / Fail-Closed",
  "label.live": "LIVE", "label.now": "ADESSO", "label.theme": "Tema", "label.language": "Lingua", "label.sound": "Suono",
  "label.system": "Sistema", "label.operational": "Tutti i sistemi operativi", "action.search": "Cerca…",
};

// ---- DRAFT translations (needs professional review) -------------------------
// Best-effort UI drafts so all 20 languages render. Marked `draft` in LANGUAGES
// and flagged in the UI. Do not treat as reviewed production copy.

const zh: Dict = {
  "app.tag": "可信控制平面",
  "nav.overview": "概览", "nav.analytics": "分析", "nav.identity": "身份", "nav.provenance": "来源", "nav.abuse": "滥用信号", "nav.settings": "设置", "nav.profile": "个人资料",
  "section.traffic": "实时流量", "section.dataflow": "数据流", "section.events": "事件流", "section.weather": "七日预报", "section.clock": "世界时钟", "section.markets": "市场", "section.news": "情报动态",
  "kpi.validity": "护照有效性", "kpi.throughput": "吞吐量", "kpi.latency": "中位延迟", "kpi.blocked": "已拦截 / 安全关闭",
  "label.live": "实时", "label.now": "现在", "label.theme": "主题", "label.language": "语言", "label.sound": "声音", "label.system": "系统", "label.operational": "所有系统正常运行", "action.search": "搜索…",
};
const ja: Dict = {
  "app.tag": "信頼された制御プレーン",
  "nav.overview": "概要", "nav.analytics": "分析", "nav.identity": "アイデンティティ", "nav.provenance": "来歴", "nav.abuse": "不正シグナル", "nav.settings": "設定", "nav.profile": "プロフィール",
  "section.traffic": "ライブトラフィック", "section.dataflow": "データフロー", "section.events": "イベントストリーム", "section.weather": "7日間予報", "section.clock": "世界時計", "section.markets": "マーケット", "section.news": "インテリジェンスフィード",
  "kpi.validity": "パスポート有効性", "kpi.throughput": "スループット", "kpi.latency": "中央値レイテンシ", "kpi.blocked": "ブロック / フェイルクローズ",
  "label.live": "ライブ", "label.now": "現在", "label.theme": "テーマ", "label.language": "言語", "label.sound": "サウンド", "label.system": "システム", "label.operational": "全システム正常", "action.search": "検索…",
};
const ru: Dict = {
  "app.tag": "Доверенная плоскость управления",
  "nav.overview": "Обзор", "nav.analytics": "Аналитика", "nav.identity": "Идентичность", "nav.provenance": "Происхождение", "nav.abuse": "Сигналы о злоупотреблениях", "nav.settings": "Настройки", "nav.profile": "Профиль",
  "section.traffic": "Живой трафик", "section.dataflow": "Поток данных", "section.events": "Поток событий", "section.weather": "Прогноз на 7 дней", "section.clock": "Мировые часы", "section.markets": "Рынки", "section.news": "Лента данных",
  "kpi.validity": "Действительность паспорта", "kpi.throughput": "Пропускная способность", "kpi.latency": "Медианная задержка", "kpi.blocked": "Заблокировано / Безопасный отказ",
  "label.live": "В ЭФИРЕ", "label.now": "СЕЙЧАС", "label.theme": "Тема", "label.language": "Язык", "label.sound": "Звук", "label.system": "Система", "label.operational": "Все системы работают", "action.search": "Поиск…",
};
const hi: Dict = {
  "app.tag": "विश्वसनीय नियंत्रण तल",
  "nav.overview": "अवलोकन", "nav.analytics": "विश्लेषण", "nav.identity": "पहचान", "nav.provenance": "उद्गम", "nav.abuse": "दुरुपयोग संकेत", "nav.settings": "सेटिंग्स", "nav.profile": "प्रोफ़ाइल",
  "section.traffic": "लाइव ट्रैफ़िक", "section.dataflow": "डेटा प्रवाह", "section.events": "इवेंट स्ट्रीम", "section.weather": "7-दिन का पूर्वानुमान", "section.clock": "विश्व घड़ी", "section.markets": "बाज़ार", "section.news": "इंटेलिजेंस फ़ीड",
  "kpi.validity": "पासपोर्ट वैधता", "kpi.throughput": "थ्रूपुट", "kpi.latency": "माध्य विलंबता", "kpi.blocked": "अवरुद्ध / सुरक्षित बंद",
  "label.live": "लाइव", "label.now": "अभी", "label.theme": "थीम", "label.language": "भाषा", "label.sound": "ध्वनि", "label.system": "सिस्टम", "label.operational": "सभी सिस्टम चालू", "action.search": "खोजें…",
};
const ko: Dict = {
  "app.tag": "신뢰할 수 있는 제어 플레인",
  "nav.overview": "개요", "nav.analytics": "분석", "nav.identity": "신원", "nav.provenance": "출처", "nav.abuse": "남용 신호", "nav.settings": "설정", "nav.profile": "프로필",
  "section.traffic": "실시간 트래픽", "section.dataflow": "데이터 흐름", "section.events": "이벤트 스트림", "section.weather": "7일 예보", "section.clock": "세계 시계", "section.markets": "시장", "section.news": "인텔리전스 피드",
  "kpi.validity": "여권 유효성", "kpi.throughput": "처리량", "kpi.latency": "중앙값 지연", "kpi.blocked": "차단됨 / 안전 종료",
  "label.live": "실시간", "label.now": "지금", "label.theme": "테마", "label.language": "언어", "label.sound": "소리", "label.system": "시스템", "label.operational": "모든 시스템 정상", "action.search": "검색…",
};
const nl: Dict = {
  "app.tag": "Vertrouwd controlevlak",
  "nav.overview": "Overzicht", "nav.analytics": "Analyse", "nav.identity": "Identiteit", "nav.provenance": "Herkomst", "nav.abuse": "Misbruiksignalen", "nav.settings": "Instellingen", "nav.profile": "Profiel",
  "section.traffic": "Live verkeer", "section.dataflow": "Gegevensstroom", "section.events": "Gebeurtenisstroom", "section.weather": "7-daagse voorspelling", "section.clock": "Wereldklok", "section.markets": "Markten", "section.news": "Inlichtingenfeed",
  "kpi.validity": "Paspoortgeldigheid", "kpi.throughput": "Doorvoer", "kpi.latency": "Mediane latentie", "kpi.blocked": "Geblokkeerd / Fail-closed",
  "label.live": "LIVE", "label.now": "NU", "label.theme": "Thema", "label.language": "Taal", "label.sound": "Geluid", "label.system": "Systeem", "label.operational": "Alle systemen operationeel", "action.search": "Zoeken…",
};
const tr: Dict = {
  "app.tag": "Güvenilir Kontrol Düzlemi",
  "nav.overview": "Genel Bakış", "nav.analytics": "Analitik", "nav.identity": "Kimlik", "nav.provenance": "Köken", "nav.abuse": "Kötüye Kullanım Sinyalleri", "nav.settings": "Ayarlar", "nav.profile": "Profil",
  "section.traffic": "Canlı Trafik", "section.dataflow": "Veri Akışı", "section.events": "Olay Akışı", "section.weather": "7 Günlük Tahmin", "section.clock": "Dünya Saati", "section.markets": "Piyasalar", "section.news": "İstihbarat Akışı",
  "kpi.validity": "Pasaport Geçerliliği", "kpi.throughput": "Verim", "kpi.latency": "Ortanca Gecikme", "kpi.blocked": "Engellendi / Güvenli Kapanma",
  "label.live": "CANLI", "label.now": "ŞİMDİ", "label.theme": "Tema", "label.language": "Dil", "label.sound": "Ses", "label.system": "Sistem", "label.operational": "Tüm sistemler çalışıyor", "action.search": "Ara…",
};
const pl: Dict = {
  "app.tag": "Zaufana płaszczyzna kontroli",
  "nav.overview": "Przegląd", "nav.analytics": "Analityka", "nav.identity": "Tożsamość", "nav.provenance": "Pochodzenie", "nav.abuse": "Sygnały nadużyć", "nav.settings": "Ustawienia", "nav.profile": "Profil",
  "section.traffic": "Ruch na żywo", "section.dataflow": "Przepływ danych", "section.events": "Strumień zdarzeń", "section.weather": "Prognoza 7-dniowa", "section.clock": "Zegar światowy", "section.markets": "Rynki", "section.news": "Kanał wywiadowczy",
  "kpi.validity": "Ważność paszportu", "kpi.throughput": "Przepustowość", "kpi.latency": "Mediana opóźnienia", "kpi.blocked": "Zablokowane / Fail-closed",
  "label.live": "NA ŻYWO", "label.now": "TERAZ", "label.theme": "Motyw", "label.language": "Język", "label.sound": "Dźwięk", "label.system": "System", "label.operational": "Wszystkie systemy działają", "action.search": "Szukaj…",
};
const sv: Dict = {
  "app.tag": "Betrott kontrollplan",
  "nav.overview": "Översikt", "nav.analytics": "Analys", "nav.identity": "Identitet", "nav.provenance": "Ursprung", "nav.abuse": "Missbrukssignaler", "nav.settings": "Inställningar", "nav.profile": "Profil",
  "section.traffic": "Livetrafik", "section.dataflow": "Dataflöde", "section.events": "Händelseström", "section.weather": "7-dagarsprognos", "section.clock": "Världsklocka", "section.markets": "Marknader", "section.news": "Underrättelseflöde",
  "kpi.validity": "Passets giltighet", "kpi.throughput": "Genomströmning", "kpi.latency": "Medianlatens", "kpi.blocked": "Blockerad / Fail-closed",
  "label.live": "LIVE", "label.now": "NU", "label.theme": "Tema", "label.language": "Språk", "label.sound": "Ljud", "label.system": "System", "label.operational": "Alla system i drift", "action.search": "Sök…",
};
const he: Dict = {
  "app.tag": "מישור בקרה מהימן",
  "nav.overview": "סקירה", "nav.analytics": "אנליטיקה", "nav.identity": "זהות", "nav.provenance": "מקור", "nav.abuse": "איתותי שימוש לרעה", "nav.settings": "הגדרות", "nav.profile": "פרופיל",
  "section.traffic": "תעבורה חיה", "section.dataflow": "זרימת נתונים", "section.events": "זרם אירועים", "section.weather": "תחזית ל-7 ימים", "section.clock": "שעון עולמי", "section.markets": "שווקים", "section.news": "הזנת מודיעין",
  "kpi.validity": "תוקף דרכון", "kpi.throughput": "תפוקה", "kpi.latency": "השהיה חציונית", "kpi.blocked": "נחסם / כשל בטוח",
  "label.live": "חי", "label.now": "עכשיו", "label.theme": "ערכת נושא", "label.language": "שפה", "label.sound": "צליל", "label.system": "מערכת", "label.operational": "כל המערכות פועלות", "action.search": "חיפוש…",
};
const fa: Dict = {
  "app.tag": "صفحه کنترل مورد اعتماد",
  "nav.overview": "نمای کلی", "nav.analytics": "تحلیل", "nav.identity": "هویت", "nav.provenance": "منشأ", "nav.abuse": "سیگنال‌های سوءاستفاده", "nav.settings": "تنظیمات", "nav.profile": "نمایه",
  "section.traffic": "ترافیک زنده", "section.dataflow": "جریان داده", "section.events": "جریان رویداد", "section.weather": "پیش‌بینی ۷ روزه", "section.clock": "ساعت جهانی", "section.markets": "بازارها", "section.news": "خوراک اطلاعاتی",
  "kpi.validity": "اعتبار گذرنامه", "kpi.throughput": "توان عملیاتی", "kpi.latency": "تأخیر میانه", "kpi.blocked": "مسدود / شکست ایمن",
  "label.live": "زنده", "label.now": "اکنون", "label.theme": "پوسته", "label.language": "زبان", "label.sound": "صدا", "label.system": "سیستم", "label.operational": "همه سیستم‌ها فعال", "action.search": "جستجو…",
};
const id: Dict = {
  "app.tag": "Bidang Kontrol Tepercaya",
  "nav.overview": "Ikhtisar", "nav.analytics": "Analitik", "nav.identity": "Identitas", "nav.provenance": "Asal", "nav.abuse": "Sinyal Penyalahgunaan", "nav.settings": "Pengaturan", "nav.profile": "Profil",
  "section.traffic": "Lalu Lintas Langsung", "section.dataflow": "Aliran Data", "section.events": "Aliran Peristiwa", "section.weather": "Prakiraan 7 Hari", "section.clock": "Jam Dunia", "section.markets": "Pasar", "section.news": "Umpan Intelijen",
  "kpi.validity": "Validitas Paspor", "kpi.throughput": "Throughput", "kpi.latency": "Latensi Median", "kpi.blocked": "Diblokir / Gagal-Aman",
  "label.live": "LANGSUNG", "label.now": "SEKARANG", "label.theme": "Tema", "label.language": "Bahasa", "label.sound": "Suara", "label.system": "Sistem", "label.operational": "Semua sistem beroperasi", "action.search": "Cari…",
};
const uk: Dict = {
  "app.tag": "Довірена площина керування",
  "nav.overview": "Огляд", "nav.analytics": "Аналітика", "nav.identity": "Ідентичність", "nav.provenance": "Походження", "nav.abuse": "Сигнали зловживань", "nav.settings": "Налаштування", "nav.profile": "Профіль",
  "section.traffic": "Живий трафік", "section.dataflow": "Потік даних", "section.events": "Потік подій", "section.weather": "Прогноз на 7 днів", "section.clock": "Світовий годинник", "section.markets": "Ринки", "section.news": "Стрічка розвідданих",
  "kpi.validity": "Дійсність паспорта", "kpi.throughput": "Пропускна здатність", "kpi.latency": "Медіанна затримка", "kpi.blocked": "Заблоковано / Безпечна відмова",
  "label.live": "НАЖИВО", "label.now": "ЗАРАЗ", "label.theme": "Тема", "label.language": "Мова", "label.sound": "Звук", "label.system": "Система", "label.operational": "Усі системи працюють", "action.search": "Пошук…",
};

export const DICTS: Partial<Record<Lang, Dict>> = { en, es, fr, de, ar, pt, it, zh, ja, ru, hi, ko, nl, tr, pl, sv, he, fa, id, uk };
