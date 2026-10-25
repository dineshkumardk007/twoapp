// Internationalization (i18n) Framework for Two
// Supported Locales: English (en), Spanish (es), French (fr), German (de), Japanese (ja), Hindi (hi)
//
// Tamil (ta) is the one offered on screen, beside English (OFFERED_LOCALES);
// the others translate only the few words in `translations` below and were
// never reachable from Settings.
//
// Words in Tamil are looked up by their English (tr, with the dictionary in
// i18n.ta.ts), so the English on screen stays exactly what it was and a word
// with no Tamil yet simply stays English. Only what is shown is translated:
// what goes to the other phone - a status chosen from the list, a heart's
// own words, "Photo" in the quote of a reply - travels in English and is put
// into each phone's own language when it is shown there.

import { createContext, useContext } from 'react';
import { TA } from './i18n.ta';

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'hi' | 'ta';

export interface Translations {
  appName: string;
  tagline: string;
  encryptedNotice: string;
  perspective: string;
  you: string;
  partner: string;
  tabs: {
    home: string;
    chat: string;
    rituals: string;
    letters: string;
    adventures: string;
    decks: string;
    cycle: string;
    journal: string;
    repair: string;
    lists: string;
    chores: string;
    money: string;
    timeline: string;
    settings: string;
  };
  actions: {
    quickExit: string;
    camouflage: string;
    storyTour: string;
    exportData: string;
    vaultBackup: string;
    wipeDevice: string;
    sensoryPulse: string;
    meshSync: string;
    save: string;
    cancel: string;
  };
  settings: {
    title: string;
    subtitle: string;
    themeTitle: string;
    languageTitle: string;
    camouflageTitle: string;
    camouflageDesc: string;
    engageCamouflage: string;
    dualWindowTitle: string;
    dualWindowDesc: string;
    openDualWindow: string;
    auditTitle: string;
    auditDesc: string;
    vaultTitle: string;
    vaultDesc: string;
    wipeTitle: string;
    wipeDesc: string;
    wipeConfirmBtn: string;
  };
}

export const translations: Record<Exclude<Locale, 'ta'>, Translations> = {
  en: {
    appName: 'Two',
    tagline: 'An analogue-warm, cryptographically sovereign space for two.',
    encryptedNotice: 'End-to-End Encrypted',
    perspective: 'Perspective',
    you: 'You',
    partner: 'Partner',
    tabs: {
      home: 'Today',
      chat: 'Chat',
      rituals: 'Rituals',
      letters: 'Letters',
      adventures: 'Adventures',
      decks: 'Decks',
      cycle: 'Cycle',
      journal: 'Journal',
      repair: 'Repair Kit',
      lists: 'Lists',
      chores: 'Mental Load',
      money: 'Tab',
      timeline: 'Memories',
      settings: 'Settings',
    },
    actions: {
      quickExit: 'Quick Exit: hide Two now',
      camouflage: 'Calculator Disguise',
      storyTour: 'A Day in the Life Tour',
      exportData: 'Download Everything (JSON)',
      vaultBackup: 'Manage Backups (.two‑vault)',
      wipeDevice: 'Erase this phone',
      sensoryPulse: 'Send a Heart Touch',
      meshSync: 'Nearby Sync',
      save: 'Save',
      cancel: 'Cancel',
    },
    settings: {
      title: 'Settings',
      subtitle: 'Your link code and devices, the app lock, the calculator disguise, backups and safety.',
      themeTitle: 'Tactile Aesthetic Theme',
      languageTitle: 'Language & Locale',
      camouflageTitle: 'Calculator Disguise',
      camouflageDesc: 'Makes Two look like a working calculator. The tab title becomes "Calculator", with a calculator icon. Type 142.85= to come back.',
      engageCamouflage: 'Switch to the Calculator Now',
      dualWindowTitle: 'Dual-Window Live Sync Demonstration',
      dualWindowDesc: 'Open your partner perspective in a side-by-side window. Any message, mood check-in, or list item will sync live over the local WebSocket relay.',
      openDualWindow: 'Open Partner Window Side-by-Side (?perspective=partner)',
      auditTitle: 'Privacy Log',
      auditDesc: 'Each time something sensitive is shared or saved - a location, cycle details, an export - it is noted here:',
      vaultTitle: 'Backups (.two‑vault)',
      vaultDesc: 'Save everything in a password-locked file that you keep. Restore it on any phone, with no server involved.',
      wipeTitle: 'Erase this phone',
      wipeDesc: 'If you are ever unsafe, this deletes everything on this phone - messages, photos, notes and the link to your space - without a sound and without telling your partner. Make a backup first if you may want it back. To only hide Two, use Quick Exit in Tools.',
      wipeConfirmBtn: 'Erase everything',
    },
  },
  es: {
    appName: 'Two',
    tagline: 'Un espacio analógico, cálido y soberano para dos.',
    encryptedNotice: 'Cifrado de Extremo a Extremo',
    perspective: 'Perspectiva',
    you: 'Tú',
    partner: 'Pareja',
    tabs: {
      home: 'Hoy',
      chat: 'Chat',
      rituals: 'Rituales',
      letters: 'Cartas',
      adventures: 'Aventuras',
      decks: 'Barajas',
      cycle: 'Ciclo',
      journal: 'Diario',
      repair: 'Reparación',
      lists: 'Listas',
      chores: 'Carga Mental',
      money: 'Cuentas',
      timeline: 'Recuerdos',
      settings: 'Ajustes',
    },
    actions: {
      quickExit: 'Salida de Emergencia y Borrado Silencioso',
      camouflage: 'Modo Camuflaje (Calculadora Discreta)',
      storyTour: 'Paseo: Un Día en la Vida',
      exportData: 'Exportar Datos del Espacio (JSON)',
      vaultBackup: 'Gestionar Copias de Seguridad (.two‑vault)',
      wipeDevice: 'Salida Rápida de Emergencia y Borrado',
      sensoryPulse: 'Enviar Pulso Sensorial',
      meshSync: 'Sincronización Fuera de Red',
      save: 'Guardar',
      cancel: 'Cancelar',
    },
    settings: {
      title: 'Ajustes y Soberanía del Espacio',
      subtitle: 'Temas táctiles, camuflaje discreto, auditoría de consentimiento y salida segura.',
      themeTitle: 'Tema Estético Táctil',
      languageTitle: 'Idioma y Región',
      camouflageTitle: 'Modo Camuflaje / Señuelo Discreto',
      camouflageDesc: 'Enmascara instantáneamente la aplicación como una calculadora funcional. El título de la pestaña cambia a "Calculadora". Ingresa 142.85= para regresar.',
      engageCamouflage: 'Activar Camuflaje de Calculadora Ahora',
      dualWindowTitle: 'Demostración de Sincronización en Dos Ventanas',
      dualWindowDesc: 'Abre la perspectiva de tu pareja en una ventana paralela. Todo cambio se sincroniza en tiempo real mediante WebSocket local.',
      openDualWindow: 'Abrir Ventana de Pareja (?perspective=partner)',
      auditTitle: 'Registro de Auditoría de Consentimiento Bidireccional',
      auditDesc: 'Todo acceso a datos confidenciales queda registrado de forma transparente aquí:',
      vaultTitle: 'Copia de Seguridad Cifrada (.two‑vault)',
      vaultDesc: 'Crea una copia 100% offline cifrada con contraseña y AES-GCM 256. Restaura en cualquier dispositivo.',
      wipeTitle: 'Arquitectura Segura de Salida: Borrado Inmediato',
      wipeDesc: 'En caso de riesgo, tritura inmediatamente las claves locales y borra los datos sin avisos ni alarmas.',
      wipeConfirmBtn: 'Confirmar Borrado Inmediato',
    },
  },
  fr: {
    appName: 'Two',
    tagline: 'Un espace chaleureux, analogique et souverain pour deux.',
    encryptedNotice: 'Chiffré de Bout en Bout',
    perspective: 'Perspective',
    you: 'Vous',
    partner: 'Partenaire',
    tabs: {
      home: 'Aujourd’hui',
      chat: 'Discussion',
      rituals: 'Rituels',
      letters: 'Lettres',
      adventures: 'Aventures',
      decks: 'Cartes',
      cycle: 'Cycle',
      journal: 'Journal',
      repair: 'Réparation',
      lists: 'Listes',
      chores: 'Charge Mentale',
      money: 'Comptes',
      timeline: 'Souvenirs',
      settings: 'Paramètres',
    },
    actions: {
      quickExit: 'Sortie d’Urgence et Effacement Silencieux',
      camouflage: 'Mode Camouflage (Calculatrice Discrète)',
      storyTour: 'Visite guidée : Une Journée Partagée',
      exportData: 'Exporter les Données (JSON)',
      vaultBackup: 'Gérer les Sauvegardes (.two‑vault)',
      wipeDevice: 'Sortie d’Urgence & Effacement Local',
      sensoryPulse: 'Envoyer une Impulsion Douce',
      meshSync: 'Synchronisation Hors Ligne',
      save: 'Enregistrer',
      cancel: 'Annuler',
    },
    settings: {
      title: 'Paramètres & Souveraineté',
      subtitle: 'Thèmes tactiles, camouflage discret, journal de consentement et sortie sécurisée.',
      themeTitle: 'Thème Esthétique Tactile',
      languageTitle: 'Langue & Localisation',
      camouflageTitle: 'Mode Camouflage Discret',
      camouflageDesc: 'Transforme instantanément l’application en calculatrice fonctionnelle. L’onglet devient "Calculatrice". Tapez 142.85= pour déverrouiller.',
      engageCamouflage: 'Activer le Camouflage Calculatrice',
      dualWindowTitle: 'Démonstration Double Fenêtre en Direct',
      dualWindowDesc: 'Ouvrez la perspective de votre partenaire côte à côte. Les échanges sont synchronisés en direct via WebSocket.',
      openDualWindow: 'Ouvrir la Fenêtre Partenaire (?perspective=partner)',
      auditTitle: 'Journal d’Audit de Consentement Réciproque',
      auditDesc: 'Chaque accès aux données sensibles est consigné visiblement ici :',
      vaultTitle: 'Sauvegarde Sécurisée du Coffre (.two‑vault)',
      vaultDesc: 'Créez un fichier 100% hors-ligne chiffré par mot de passe avec AES-GCM 256.',
      wipeTitle: 'Sortie Sécurisée : Effacement d’Urgence',
      wipeDesc: 'En situation de danger, détruit instantanément les clés locales sans notifier votre partenaire.',
      wipeConfirmBtn: 'Confirmer l’Effacement Immédiat',
    },
  },
  de: {
    appName: 'Two',
    tagline: 'Ein haptisch-warmer, kryptografisch souveräner Raum für Zwei.',
    encryptedNotice: 'Ende-zu-Ende Verschlüsselt',
    perspective: 'Perspektive',
    you: 'Du',
    partner: 'Partner',
    tabs: {
      home: 'Heute',
      chat: 'Chat',
      rituals: 'Rituale',
      letters: 'Briefe',
      adventures: 'Abenteuer',
      decks: 'Karten',
      cycle: 'Zyklus',
      journal: 'Tagebuch',
      repair: 'Klärung',
      lists: 'Listen',
      chores: 'Mental Load',
      money: 'Ausgaben',
      timeline: 'Erinnerungen',
      settings: 'Einstellungen',
    },
    actions: {
      quickExit: 'Notausstieg & Stumme Datenlöschung',
      camouflage: 'Tarnmodus (Diskreter Taschenrechner)',
      storyTour: 'Erlebnistour: Ein Tag zu zweit',
      exportData: 'Raumdaten Exportieren (JSON)',
      vaultBackup: 'Tresor-Backups Verwalten (.two‑vault)',
      wipeDevice: 'Notausstieg & Gerät Sofort Löschen',
      sensoryPulse: 'Sanften Sensorischen Puls Senden',
      meshSync: 'Offline-Mesh Synchronisation',
      save: 'Speichern',
      cancel: 'Abbrechen',
    },
    settings: {
      title: 'Raum-Einstellungen & Souveränität',
      subtitle: 'Haptische Themen, diskrete Tarnung, Einwilligungsprotokoll und Notausstieg.',
      themeTitle: 'Haptisches Design-Thema',
      languageTitle: 'Sprache & Region',
      camouflageTitle: 'Diskreter Tarnmodus / Köder',
      camouflageDesc: 'Verwandelt die App sofort in einen funktionierenden Taschenrechner. Der Tab heißt "Calculator". Code 142.85= entsperrt den Raum.',
      engageCamouflage: 'Taschenrechner-Tarnung Jetzt Starten',
      dualWindowTitle: 'Zwei-Fenster Live-Synchronisation',
      dualWindowDesc: 'Öffne die Partner-Perspektive in einem zweiten Fenster. Alle Daten synchronisieren live via WebSocket.',
      openDualWindow: 'Partner-Fenster Öffnen (?perspective=partner)',
      auditTitle: 'Transparenz- & Einwilligungsprotokoll',
      auditDesc: 'Jeder Zugriff auf sensible Daten wird hier lückenlos verzeichnet:',
      vaultTitle: 'Verschlüsseltes Tresor-Backup (.two‑vault)',
      vaultDesc: 'Erstelle eine 100% Offline-Sicherungsdatei mit AES-GCM 256 Passphrase.',
      wipeTitle: 'Notfall-Sicherheit: Sofortige Datenvernichtung',
      wipeDesc: 'Löscht im Gefahrenfall sofort alle lokalen Schlüssel und Daten spurlos ohne Partnersignal.',
      wipeConfirmBtn: 'Sofortige Löschung Bestätigen',
    },
  },
  ja: {
    appName: 'Two',
    tagline: 'ふたりのための、温もりと主権ある暗号化プライベート空間。',
    encryptedNotice: 'エンドツーエンド暗号化済み',
    perspective: '視点',
    you: 'あなた',
    partner: 'パートナー',
    tabs: {
      home: '今日',
      chat: 'チャット',
      rituals: '習慣・儀式',
      letters: '封蝋の手紙',
      adventures: '冒険・デート',
      decks: '対話カード',
      cycle: 'サイクル',
      journal: '日記',
      repair: '対話リペア',
      lists: 'リスト',
      chores: '家事・分担',
      money: '共有割り勘',
      timeline: '記憶の軌跡',
      settings: '設定',
    },
    actions: {
      quickExit: '緊急退出とサイレント端末初期化',
      camouflage: 'カモフラージュ偽装モード（電卓）',
      storyTour: '体験ツアー：ふたりのある一日',
      exportData: '全空間データをエクスポート (JSON)',
      vaultBackup: '暗号化バックアップ管理 (.two‑vault)',
      wipeDevice: '緊急退出・端末初期化',
      sensoryPulse: '温もりパルスを届ける',
      meshSync: 'オフライン近距離メッシュ同期',
      save: '保存',
      cancel: 'キャンセル',
    },
    settings: {
      title: '空間設定とプライバシー主権',
      subtitle: '心地よい質感テーマ、目立たない電卓偽装、同意監査ログ、安全な退出機能。',
      themeTitle: '質感テーマ選択',
      languageTitle: '言語設定',
      camouflageTitle: '目立たない電卓偽装モード',
      camouflageDesc: '画面を即座に本物の計算機に切り替えます。タブ名も「Calculator」に変わります。解除コード「142.85=」で元に戻ります。',
      engageCamouflage: '今すぐ電卓偽装を起動する',
      dualWindowTitle: '2画面リアルタイム同期デモ',
      dualWindowDesc: 'パートナー視点を別ウィンドウで並べて起動します。チャットや気分共有がローカルWebSocket経由で即時反映されます。',
      openDualWindow: 'パートナー画面を開く (?perspective=partner)',
      auditTitle: '相互同意監査ログ',
      auditDesc: '位置情報や周期などセンシティブ情報へのアクセス履歴が透明に記録されます：',
      vaultTitle: '完全暗号化バックアップ (.two‑vault)',
      vaultDesc: 'AES-GCM 256による100%オフライン暗号化バックアップを作成します。サーバー不要で復元可能です。',
      wipeTitle: '緊急安全退出：即時データ消去',
      wipeDesc: '万が一危険な状況の際、相手に通知することなく即座に本端末の暗号鍵と全データを完全消去します。',
      wipeConfirmBtn: '即時消去を実行',
    },
  },
  hi: {
    appName: 'Two',
    tagline: 'दो लोगों के लिए एक आत्मीय, सुरक्षित और एन्क्रिप्टेड निजी संसार।',
    encryptedNotice: 'एंड-टू-एंड एन्क्रिप्टेड',
    perspective: 'नज़रिया',
    you: 'आप',
    partner: 'साथी',
    tabs: {
      home: 'आज',
      chat: 'बातचीत',
      rituals: 'आत्मीय रीतियाँ',
      letters: 'प्रेम पत्र',
      adventures: 'रोमांच व डेट',
      decks: 'संवाद कार्ड',
      cycle: 'चक्र',
      journal: 'डायरी',
      repair: 'सुलह किट',
      lists: 'सूचियाँ',
      chores: 'साझा ज़िम्मेदारी',
      money: 'हिसाब-किताब',
      timeline: 'यादें',
      settings: 'सेटिंग्स',
    },
    actions: {
      quickExit: 'आपातकालीन निकास और डेटा साफ़',
      camouflage: 'कैलकुलेटर भेस मोड (गोपनीयता)',
      storyTour: 'एक साझा दिन की कहानी',
      exportData: 'डेटा निर्यात करें (JSON)',
      vaultBackup: 'वॉल्ट बैकアップ प्रबंधित करें (.two‑vault)',
      wipeDevice: 'आपातकालीन त्वरित निकास व सफाई',
      sensoryPulse: 'आत्मीय स्पर्श स्पंदन भेजें',
      meshSync: 'ऑफ़लाइन मेश सिंक',
      save: 'सहेजें',
      cancel: 'रद्द करें',
    },
    settings: {
      title: 'स्थान सेटिंग्स और संप्रभुता',
      subtitle: 'सौम्य थीम, गोपनीयता भेस, सहमति ऑडिट लॉग और आपातकालीन सुरक्षा।',
      themeTitle: 'सौंदर्यपरक थीम',
      languageTitle: 'भाषा और क्षेत्र',
      camouflageTitle: 'कैलकुलेटर भेस / सुरक्षा मोड',
      camouflageDesc: 'ऐप को तुरंत एक असली कैलकुलेटर के रूप में छुपाएं। टैब का नाम "Calculator" हो जाएगा। वापस लौटने के लिए 142.85= दर्ज करें।',
      engageCamouflage: 'कैलकुलेटर भेस सक्रिय करें',
      dualWindowTitle: 'दोहरी विंडो लाइव सिंक प्रदर्शन',
      dualWindowDesc: 'अपने साथी का नज़रिया बगल की विंडो में खोलें। संदेश और मूड अपडेट तुरंत लाइव सिंक होंगे।',
      openDualWindow: 'साथी विंडो खोलें (?perspective=partner)',
      auditTitle: 'द्वि-दिशात्मक सहमति ऑडिट लॉग',
      auditDesc: 'संवेदनशील डेटा तक किसी भी पहुँच का विवरण यहाँ सुरक्षित रहता है:',
      vaultTitle: 'एन्क्रिप्टेड वॉल्ट बैकअप (.two‑vault)',
      vaultDesc: 'AES-GCM 256 के साथ पासवर्ड-सुरक्षित 100% ऑफ़लाइन बैकअप फ़ाइल बनाएं।',
      wipeTitle: 'सुरक्षित निकास: तत्काल डिवाइस सफाई',
      wipeDesc: 'किसी भी असुरक्षित स्थिति में, यह बटन साथी को सूचित किए बिना इस डिवाइस से सभी डेटा को तुरंत मिटा देता है।',
      wipeConfirmBtn: 'तत्काल डेटा मिटाएं',
    },
  },
};

export const getTranslation = (locale: Locale): Translations => {
  // Tamil: the menu's words; Settings is not in Tamil yet.
  if (locale === 'ta') return { ...translations.en, you: tr('You'), partner: tr('Partner'), tabs: taTabs(), actions: taActions() };
  return translations[locale] || translations.en;
};

const taTabs = (): Translations['tabs'] => {
  const en = translations.en.tabs;
  return Object.fromEntries(Object.entries(en).map(([k, v]) => [k, tr(v)])) as Translations['tabs'];
};
const taActions = (): Translations['actions'] => {
  const en = translations.en.actions;
  return Object.fromEntries(Object.entries(en).map(([k, v]) => [k, tr(v)])) as Translations['actions'];
};

/** The languages Settings offers, each named in itself. */
export const OFFERED_LOCALES: ReadonlyArray<{ id: Locale; name: string }> = [
  { id: 'en', name: 'English' },
  { id: 'ta', name: 'தமிழ்' }
];

const LOCALE_KEY = 'two_locale_v1';

/** This phone's language: chosen here, kept on this phone only. */
export function readLocale(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_KEY);
    return OFFERED_LOCALES.some(l => l.id === raw) ? (raw as Locale) : 'en';
  } catch {
    return 'en';
  }
}

let current: Locale = readLocale();

/** The language words are being put into right now. */
export function activeLocale(): Locale {
  return current;
}

/**
 * Switches the words to another language, and keeps the choice. Called before
 * the screen is drawn again (App), so everything drawn after says it the new way.
 */
export function chooseLocale(locale: Locale): void {
  current = locale;
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* storage unavailable: the choice lasts until Two is closed */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

const DICTIONARIES: Partial<Record<Locale, Readonly<Record<string, string>>>> = { ta: TA };

export type Vars = Record<string, string | number>;

/**
 * These English words in this phone's language - unchanged when there is no
 * translation for them. `{name}` in them is filled from `vars`.
 */
export function tr(english: string, vars?: Vars): string {
  const said = DICTIONARIES[current]?.[english] ?? english;
  return vars ? said.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole)) : said;
}

/**
 * English with two meanings on screen - "Clear" weather and a "Clear" button:
 * the dictionary holds this meaning as "Clear (status)". In English, and in a
 * language without that entry, the English is shown as it is.
 */
export function trMeaning(english: string, meaning: string): string {
  return DICTIONARIES[current]?.[`${english} (${meaning})`] ?? english;
}

/** For dates and times written by the phone: Tamil month and day names in Tamil. */
export function dateLocale(): string | undefined {
  return current === 'ta' ? 'ta-IN' : undefined;
}

/** Changes when the language does, so whatever reads it is drawn again. */
export const LocaleContext = createContext<Locale>(current);

/** tr, for a component: drawn again when the language changes. */
export function useT(): typeof tr {
  useContext(LocaleContext);
  return tr;
}
