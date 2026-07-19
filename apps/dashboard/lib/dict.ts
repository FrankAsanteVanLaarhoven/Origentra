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

export interface LangMeta { code: Lang; name: string; native: string; rtl?: boolean; full?: boolean }

export const LANGUAGES: LangMeta[] = [
  { code: "en", name: "English", native: "English", full: true },
  { code: "es", name: "Spanish", native: "Español", full: true },
  { code: "fr", name: "French", native: "Français", full: true },
  { code: "de", name: "German", native: "Deutsch", full: true },
  { code: "ar", name: "Arabic", native: "العربية", rtl: true, full: true },
  { code: "zh", name: "Chinese", native: "中文" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "sv", name: "Swedish", native: "Svenska" },
  { code: "he", name: "Hebrew", native: "עברית", rtl: true },
  { code: "fa", name: "Persian", native: "فارسی", rtl: true },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
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

export const DICTS: Partial<Record<Lang, Dict>> = { en, es, fr, de, ar };
