/**
 * Seed für OMSI Mod Hub.
 *
 * - Kategorien und Tags: produktive Stammdaten (Upsert, idempotent).
 * - Creator und Projekte: ausschließlich Entwicklungs-Beispieldaten (isSample = true).
 *   Sie beschreiben fiktive Projekte, verlinken nur auf example.com und werden bei
 *   jedem Lauf gelöscht und neu angelegt. Mit SEED_SAMPLES=false werden sie übersprungen.
 *
 * Es werden bewusst keine Admin-Konten und keine Passwörter angelegt.
 */
import "dotenv/config";

import type { LinkSourceType, RequirementPricing } from "../src/generated/prisma/client";
import { createPrismaClient } from "../src/lib/prisma-factory";
import { parseExternalUrl } from "../src/lib/external-url";
import { buildSearchText } from "../src/lib/search-text";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ist nicht gesetzt.");
const db = createPrismaClient(url);

type Locale = "de" | "en";
type L10n = Record<Locale, string>;

// ---------------------------------------------------------------------------
// Stammdaten
// ---------------------------------------------------------------------------

const CATEGORIES: { slug: string; icon: string; name: L10n; description: L10n }[] = [
  {
    slug: "busse",
    icon: "bus",
    name: { de: "Busse & Fahrzeuge", en: "Buses & vehicles" },
    description: {
      de: "Stadt-, Überland- und Gelenkbusse sowie weitere Fahrzeuge für OMSI 2.",
      en: "City, regional and articulated buses and other vehicles for OMSI 2.",
    },
  },
  {
    slug: "karten",
    icon: "map",
    name: { de: "Karten & Strecken", en: "Maps & routes" },
    description: {
      de: "Fiktive und reale Karten, Linienerweiterungen und Fahrpläne.",
      en: "Fictional and real-world maps, route extensions and timetables.",
    },
  },
  {
    slug: "repaints",
    icon: "paintbrush",
    name: { de: "Repaints", en: "Repaints" },
    description: {
      de: "Neue Lackierungen und Beschriftungen für vorhandene Fahrzeuge.",
      en: "New liveries and lettering for existing vehicles.",
    },
  },
  {
    slug: "objekte",
    icon: "boxes",
    name: { de: "Objekte & Szenerie", en: "Objects & scenery" },
    description: {
      de: "Haltestellen, Gebäude, Splines und weitere Bausteine für Kartenbauer.",
      en: "Bus stops, buildings, splines and other building blocks for map makers.",
    },
  },
  {
    slug: "sounds",
    icon: "audio-lines",
    name: { de: "Sounds", en: "Sounds" },
    description: {
      de: "Motor-, Umgebungs- und Ansagesounds.",
      en: "Engine, ambient and announcement sounds.",
    },
  },
  {
    slug: "tools",
    icon: "wrench",
    name: { de: "Tools, Skripte & Plugins", en: "Tools, scripts & plugins" },
    description: {
      de: "Hilfsprogramme, Skripte und Plugins rund um OMSI 2.",
      en: "Utilities, scripts and plugins for OMSI 2.",
    },
  },
];

const TAGS: { slug: string; name: L10n }[] = [
  { slug: "stadtverkehr", name: { de: "Stadtverkehr", en: "City service" } },
  { slug: "ueberland", name: { de: "Überland", en: "Regional service" } },
  { slug: "nachtverkehr", name: { de: "Nachtverkehr", en: "Night service" } },
  { slug: "fiktiv", name: { de: "Fiktiv", en: "Fictional" } },
  { slug: "solobus", name: { de: "Solobus", en: "Rigid bus" } },
  { slug: "gelenkbus", name: { de: "Gelenkbus", en: "Articulated bus" } },
  { slug: "midibus", name: { de: "Midibus", en: "Midibus" } },
  { slug: "diesel", name: { de: "Diesel", en: "Diesel" } },
  { slug: "haltestellen", name: { de: "Haltestellen", en: "Bus stops" } },
  { slug: "ansagen", name: { de: "Ansagen", en: "Announcements" } },
  { slug: "fahrplan", name: { de: "Fahrplan", en: "Timetable" } },
  { slug: "texturen", name: { de: "Texturen", en: "Textures" } },
  { slug: "ki-verkehr", name: { de: "KI-Verkehr", en: "AI traffic" } },
  { slug: "winter", name: { de: "Winter", en: "Winter" } },
];

// ---------------------------------------------------------------------------
// Beispieldaten (fiktiv)
// ---------------------------------------------------------------------------

type SampleCreator = {
  username: string;
  displayName: string;
  bio: string;
  verified?: boolean;
};

const CREATORS: SampleCreator[] = [
  {
    username: "nordlicht-mapping",
    displayName: "Nordlicht Mapping",
    bio: "Fiktives Kartenbau-Team (Beispieldaten). Schwerpunkt: norddeutsche Kleinstädte mit dichtem Stadtverkehr.",
    verified: true,
  },
  {
    username: "elbtal-busworks",
    displayName: "Elbtal Busworks",
    bio: "Fiktiver Fahrzeugbauer (Beispieldaten). Baut Solo-, Gelenk- und Midibusse nach eigenen Entwürfen.",
  },
  {
    username: "kessel-sound-lab",
    displayName: "Kessel Sound Lab",
    bio: "Fiktives Sound-Projekt (Beispieldaten) für Motor- und Ansagesounds.",
  },
  {
    username: "lackwerk-sued",
    displayName: "Lackwerk Süd",
    bio: "Fiktive Repaint-Werkstatt (Beispieldaten).",
  },
  {
    username: "depot-toolsmith",
    displayName: "Depot Toolsmith",
    bio: "Fictional tool developer (sample data). Small utilities that make OMSI 2 modding less painful.",
  },
];

type SampleLink = { path: string; label?: string; sourceType: LinkSourceType };
type SampleVersion = { version: string; daysAgo: number; changelog: string; links?: SampleLink[] };
type SampleText = {
  title: string;
  summary: string;
  description: string;
  installation?: string;
};

type SampleProject = {
  slug: string;
  creator: string;
  category: string;
  status?: "PUBLISHED" | "DRAFT";
  defaultLocale: Locale;
  license: string;
  gameCompatibility?: string;
  cover: string;
  coverAlt: string;
  screenshots?: { file: string; alt: string }[];
  tags: string[];
  contributors?: { name: string; role: string }[];
  /** Voraussetzungen; Links nur auf example.com (Pfad), ohne Pfad kein Link */
  requirements?: { name: string; path?: string; pricing: RequirementPricing }[];
  publishedDaysAgo: number;
  texts: Partial<Record<Locale, SampleText>>;
  versions: SampleVersion[];
};

const PROJECTS: SampleProject[] = [
  {
    slug: "neustadt-am-kanal",
    creator: "nordlicht-mapping",
    category: "karten",
    defaultLocale: "de",
    license: "Private Nutzung erlaubt. Weitergabe und Re-Uploads nur mit Zustimmung des Teams.",
    gameCompatibility: "OMSI 2.3.004",
    cover: "/samples/map-grid.svg",
    coverAlt: "Schematischer Linienplan einer fiktiven Stadt",
    screenshots: [
      { file: "/samples/map-landscape.svg", alt: "Landstraße mit Haltestelle in der Abenddämmerung" },
      { file: "/samples/shot-depot.svg", alt: "Busdepot mit drei abgestellten Fahrzeugen" },
    ],
    tags: ["stadtverkehr", "nachtverkehr", "fiktiv", "ki-verkehr"],
    contributors: [
      { name: "Mara K. (fiktiv)", role: "Splines & Kreuzungen" },
      { name: "Jonas P. (fiktiv)", role: "Fahrpläne" },
    ],
    requirements: [{ name: "Haltestellen-Baukasten (fiktiv)", path: "/addons/haltestellen-baukasten", pricing: "FREEWARE" }],
    publishedDaysAgo: 120,
    texts: {
      de: {
        title: "Neustadt am Kanal",
        summary: "Fiktive Kleinstadt mit vier Stadtlinien, Nachtnetz und dichtem KI-Verkehr.",
        description:
          "Neustadt am Kanal ist eine fiktive Kleinstadt mit Altstadt, Industriegebiet am Kanal und einer Neubausiedlung am Stadtrand.\n\nDas Netz umfasst vier Tageslinien und zwei Nachtlinien mit vollständigen Fahrplänen für Werktage, Samstage und Sonntage.\n\nHinweis: Dies ist ein Entwicklungsbeispiel und beschreibt keine echte Karte.",
        installation:
          "1. Archiv entpacken.\n2. Den Inhalt des Ordners „OMSI 2“ in das Hauptverzeichnis von OMSI 2 kopieren.\n3. Vorhandene Dateien nur überschreiben, wenn du dazu aufgefordert wirst.\n4. OMSI starten und die Karte „Neustadt am Kanal“ auswählen.",
      },
      en: {
        title: "Neustadt am Kanal",
        summary: "Fictional small town with four city routes, a night network and dense AI traffic.",
        description:
          "Neustadt am Kanal is a fictional small town with an old town, an industrial area along the canal and a new housing estate on the outskirts.\n\nThe network covers four daytime routes and two night routes with full timetables for weekdays, Saturdays and Sundays.\n\nNote: This is a development sample and does not describe a real map.",
        installation:
          "1. Extract the archive.\n2. Copy the contents of the “OMSI 2” folder into your OMSI 2 main directory.\n3. Only overwrite existing files when prompted.\n4. Start OMSI and select the map “Neustadt am Kanal”.",
      },
    },
    versions: [
      {
        version: "1.2.0",
        daysAgo: 6,
        changelog: "Nachtlinie N2 ergänzt.\nKreuzung Kanalstraße überarbeitet.\nKI-Verkehr an Sonntagen reduziert.",
        links: [
          { path: "/neustadt-am-kanal", label: "Projektseite", sourceType: "ORIGINAL_SOURCE" },
          { path: "/mirror/neustadt-am-kanal-1-2-0", label: "Mirror", sourceType: "MIRROR" },
        ],
      },
      { version: "1.1.0", daysAgo: 60, changelog: "Neubausiedlung mit Linie 4 hinzugefügt." },
      { version: "1.0.0", daysAgo: 120, changelog: "Erste Veröffentlichung." },
    ],
  },
  {
    slug: "grenzland-ueberland",
    creator: "nordlicht-mapping",
    category: "karten",
    defaultLocale: "de",
    license: "Nur private Nutzung. Keine Veränderung und Weitergabe.",
    gameCompatibility: "OMSI 2.3.004",
    cover: "/samples/map-landscape.svg",
    coverAlt: "Landstraße durch Hügel mit Haltestellenschild",
    tags: ["ueberland", "fiktiv", "winter"],
    publishedDaysAgo: 45,
    texts: {
      de: {
        title: "Grenzland Überland",
        summary: "Überlandstrecke durch eine fiktive Mittelgebirgsregion – mit Winterversion.",
        description:
          "Eine 28 Kilometer lange Überlandlinie verbindet drei Dörfer mit der Kreisstadt. Die Strecke führt über Serpentinen und schmale Ortsdurchfahrten.\n\nDiese Karte liegt nur auf Deutsch vor – ein Beispiel für den Sprach-Fallback.",
        installation: "Archiv entpacken und den Ordner „maps\\Grenzland“ in das OMSI-2-Verzeichnis kopieren.",
      },
    },
    versions: [
      {
        version: "0.9.0",
        daysAgo: 45,
        changelog: "Öffentliche Beta.",
        links: [{ path: "/grenzland-ueberland", sourceType: "FILE_HOSTER" }],
      },
    ],
  },
  {
    slug: "solobus-sl12",
    creator: "elbtal-busworks",
    category: "busse",
    defaultLocale: "de",
    license: "Private Nutzung erlaubt. Repaints erlaubt, Weitergabe des Modells nicht.",
    gameCompatibility: "OMSI 2.3.004",
    cover: "/samples/bus-city.svg",
    coverAlt: "Weißer Stadtbus mit gelbem Zierstreifen vor einer Häuserkulisse",
    screenshots: [{ file: "/samples/shot-cockpit.svg", alt: "Fahrerplatz mit Tachometer und Drehzahlmesser" }],
    tags: ["stadtverkehr", "solobus", "diesel", "fiktiv"],
    requirements: [{ name: "Dieselmotor-Sounds für SL12 (fiktiv)", path: "/addons/dieselsound-sl12", pricing: "PAYWARE" }],
    publishedDaysAgo: 200,
    texts: {
      de: {
        title: "Solobus SL12 (fiktives Modell)",
        summary: "Zwölf Meter langer Stadtbus mit drei Türen, Matrix-Anzeige und eigenem Fahrerplatz.",
        description:
          "Der SL12 ist ein frei erfundener Stadtbus. Das Modell bringt ein detailliertes Cockpit, eine programmierbare Matrix-Anzeige und zwei Getriebevarianten mit.\n\nRepaints sind ausdrücklich erwünscht – eine Vorlage liegt dem Download bei.",
        installation: "Archiv entpacken und den Ordner „Vehicles\\SL12“ in das OMSI-2-Verzeichnis kopieren.",
      },
      en: {
        title: "Rigid bus SL12 (fictional model)",
        summary: "Twelve-metre city bus with three doors, matrix display and its own cockpit.",
        description:
          "The SL12 is an entirely fictional city bus. The model comes with a detailed cockpit, a programmable matrix display and two gearbox variants.\n\nRepaints are explicitly welcome – a template is included in the download.",
        installation: "Extract the archive and copy the “Vehicles\\SL12” folder into your OMSI 2 directory.",
      },
    },
    versions: [
      {
        version: "2.0.1",
        daysAgo: 20,
        changelog: "Fehler bei der Türsteuerung behoben.",
        links: [{ path: "/solobus-sl12", sourceType: "ORIGINAL_SOURCE" }],
      },
      { version: "2.0.0", daysAgo: 90, changelog: "Neues Cockpit und zweite Getriebevariante." },
      { version: "1.0.0", daysAgo: 200, changelog: "Erste Veröffentlichung." },
    ],
  },
  {
    slug: "gelenkbus-gl18",
    creator: "elbtal-busworks",
    category: "busse",
    defaultLocale: "de",
    license: "Private Nutzung erlaubt.",
    gameCompatibility: "OMSI 2.3.004",
    cover: "/samples/bus-night.svg",
    coverAlt: "Beleuchteter Gelenkbus bei Nacht",
    tags: ["stadtverkehr", "gelenkbus", "nachtverkehr", "fiktiv"],
    publishedDaysAgo: 30,
    texts: {
      de: {
        title: "Gelenkbus GL18 (fiktives Modell)",
        summary: "Achtzehn-Meter-Gelenkbus mit Innenbeleuchtung für den Nachtverkehr.",
        description: "Der GL18 ergänzt den SL12 um eine Gelenkvariante mit vier Türen und dimmbarer Innenbeleuchtung.",
      },
      en: {
        title: "Articulated bus GL18 (fictional model)",
        summary: "Eighteen-metre articulated bus with interior lighting for night service.",
        description: "The GL18 complements the SL12 with an articulated variant featuring four doors and dimmable interior lighting.",
      },
    },
    versions: [
      {
        version: "1.0.0",
        daysAgo: 30,
        changelog: "Erste Veröffentlichung.",
        links: [{ path: "/gelenkbus-gl18", sourceType: "ORIGINAL_SOURCE" }],
      },
    ],
  },
  {
    slug: "midibus-citylink",
    creator: "elbtal-busworks",
    category: "busse",
    defaultLocale: "en",
    license: "Personal use only.",
    gameCompatibility: "OMSI 2.3.004",
    cover: "/samples/bus-city.svg",
    coverAlt: "City bus in front of an urban skyline",
    tags: ["midibus", "stadtverkehr", "fiktiv"],
    publishedDaysAgo: 12,
    texts: {
      en: {
        title: "Midibus CityLink (fictional model)",
        summary: "Compact nine-metre midibus for narrow old-town routes.",
        description:
          "A compact midibus designed for narrow streets and low-demand routes.\n\nThis project is only available in English – an example of the language fallback.",
      },
    },
    versions: [
      {
        version: "0.5.0",
        daysAgo: 12,
        changelog: "Early access release.",
        links: [{ path: "/midibus-citylink", sourceType: "FILE_HOSTER" }],
      },
    ],
  },
  {
    slug: "repaint-paket-neustadt",
    creator: "lackwerk-sued",
    category: "repaints",
    defaultLocale: "de",
    license: "Frei verwendbar, Namensnennung erwünscht.",
    gameCompatibility: "OMSI 2.3.004",
    cover: "/samples/repaint.svg",
    coverAlt: "Bus mit rot-gelber Lackierung und Farbmustern",
    tags: ["solobus", "texturen", "fiktiv"],
    requirements: [{ name: "Solobus SL12 (fiktives Modell) ab Version 2.0", path: "/addons/solobus-sl12", pricing: "FREEWARE" }],
    publishedDaysAgo: 15,
    texts: {
      de: {
        title: "Repaint-Paket: Verkehrsbetrieb Neustadt (fiktiv)",
        summary: "Drei Lackierungen eines fiktiven Verkehrsbetriebs für den Solobus SL12.",
        description: "Das Paket enthält die Hausfarben, eine Werbelackierung und eine Variante für den Schulverkehr.",
        installation: "Den Ordner „Texture“ in „Vehicles\\SL12“ kopieren.",
      },
      en: {
        title: "Repaint pack: Neustadt transport company (fictional)",
        summary: "Three liveries of a fictional operator for the SL12 rigid bus.",
        description: "The pack includes the house colours, an advertising livery and a school-service variant.",
        installation: "Copy the “Texture” folder into “Vehicles\\SL12”.",
      },
    },
    versions: [
      {
        version: "1.0",
        daysAgo: 15,
        changelog: "Erste Veröffentlichung.",
        links: [{ path: "/repaint-paket-neustadt", sourceType: "FILE_HOSTER" }],
      },
    ],
  },
  {
    slug: "haltestellen-baukasten",
    creator: "nordlicht-mapping",
    category: "objekte",
    defaultLocale: "de",
    license: "Für eigene Karten frei verwendbar, auch bei Veröffentlichung.",
    gameCompatibility: "OMSI 2.3.004",
    cover: "/samples/objects.svg",
    coverAlt: "Isometrische Darstellung eines Wartehäuschens",
    tags: ["haltestellen", "fiktiv"],
    publishedDaysAgo: 80,
    texts: {
      de: {
        title: "Haltestellen-Baukasten",
        summary: "Über 40 Wartehäuschen, Masten und Fahrplanaushänge für Kartenbauer.",
        description: "Modulare Haltestellenobjekte in drei Stilen: Altstadt, Vorort und Überland.",
      },
      en: {
        title: "Bus stop construction kit",
        summary: "More than 40 shelters, poles and timetable displays for map makers.",
        description: "Modular bus stop objects in three styles: old town, suburb and countryside.",
      },
    },
    versions: [
      {
        version: "3.1",
        daysAgo: 25,
        changelog: "Neue Überland-Masten ergänzt.",
        links: [{ path: "/haltestellen-baukasten", sourceType: "ORIGINAL_SOURCE" }],
      },
      { version: "3.0", daysAgo: 80, changelog: "Komplett überarbeitete Texturen." },
    ],
  },
  {
    slug: "dieselsound-sl12",
    creator: "kessel-sound-lab",
    category: "sounds",
    defaultLocale: "de",
    license: "Private Nutzung erlaubt.",
    gameCompatibility: "OMSI 2.3.004",
    cover: "/samples/sound.svg",
    coverAlt: "Farbige Wellenform eines Motorgeräuschs",
    tags: ["diesel", "solobus"],
    requirements: [{ name: "Solobus SL12 (fiktives Modell)", pricing: "FREEWARE" }],
    publishedDaysAgo: 18,
    texts: {
      de: {
        title: "Dieselmotor-Sounds für SL12",
        summary: "Neu aufbereitetes Motorgeräusch mit Leerlauf, Kickdown und Retarder.",
        description: "Das Soundpaket ersetzt die Standardsounds des SL12 durch eine detailliertere Variante.",
      },
      en: {
        title: "Diesel engine sounds for SL12",
        summary: "Reworked engine sound with idle, kickdown and retarder.",
        description: "This sound pack replaces the default SL12 sounds with a more detailed variant.",
      },
    },
    versions: [
      {
        version: "1.1",
        daysAgo: 4,
        changelog: "Retarder-Sound lauter abgemischt.",
        links: [{ path: "/dieselsound-sl12", sourceType: "FILE_HOSTER" }],
      },
      { version: "1.0", daysAgo: 18, changelog: "Erste Veröffentlichung." },
    ],
  },
  {
    slug: "ansagen-baukasten",
    creator: "kessel-sound-lab",
    category: "sounds",
    defaultLocale: "de",
    license: "Nur nicht-kommerzielle Nutzung.",
    cover: "/samples/sound.svg",
    coverAlt: "Wellenform einer Haltestellenansage",
    tags: ["ansagen"],
    publishedDaysAgo: 65,
    texts: {
      de: {
        title: "Fahrgastansagen-Baukasten",
        summary: "Bausteine für eigene Haltestellenansagen mit neutraler Stimme.",
        description: "Enthält Gong, Satzbausteine und eine Anleitung zum Erstellen eigener Ansagen.",
      },
      en: {
        title: "Passenger announcement kit",
        summary: "Building blocks for custom stop announcements with a neutral voice.",
        description: "Includes a chime, sentence fragments and a guide to creating your own announcements.",
      },
    },
    versions: [
      {
        version: "1.0",
        daysAgo: 65,
        changelog: "Erste Veröffentlichung.",
        links: [{ path: "/ansagen-baukasten", sourceType: "ORIGINAL_SOURCE" }],
      },
    ],
  },
  {
    slug: "fahrplan-pruefer",
    creator: "depot-toolsmith",
    category: "tools",
    defaultLocale: "en",
    license: "MIT licence.",
    cover: "/samples/tool.svg",
    coverAlt: "Terminal window with a dependency check output",
    tags: ["fahrplan", "texturen"],
    publishedDaysAgo: 9,
    texts: {
      en: {
        title: "Timetable & dependency checker",
        summary: "Command-line tool that finds missing objects, textures and timetable errors.",
        description: "Scans a map folder and lists missing files and inconsistent timetable entries before you publish.",
        installation: "Extract anywhere and run the tool from a command prompt. No installation required.",
      },
      de: {
        title: "Fahrplan- & Abhängigkeitsprüfer",
        summary: "Kommandozeilenwerkzeug, das fehlende Objekte, Texturen und Fahrplanfehler findet.",
        description: "Durchsucht einen Kartenordner und listet fehlende Dateien und widersprüchliche Fahrplaneinträge auf.",
        installation: "Beliebig entpacken und aus der Eingabeaufforderung starten. Keine Installation nötig.",
      },
    },
    versions: [
      {
        version: "0.3.0",
        daysAgo: 9,
        changelog: "Prüft jetzt auch Fahrplandateien.",
        links: [{ path: "/fahrplan-pruefer", sourceType: "ORIGINAL_SOURCE" }],
      },
    ],
  },
  {
    // Entwurf: darf öffentlich nirgends erscheinen (prüft die Statusfilter).
    slug: "unveroeffentlichter-entwurf",
    creator: "depot-toolsmith",
    category: "tools",
    status: "DRAFT",
    defaultLocale: "de",
    license: "–",
    cover: "/samples/tool.svg",
    coverAlt: "Terminal",
    tags: [],
    publishedDaysAgo: 0,
    texts: {
      de: { title: "Unveröffentlichter Entwurf", summary: "Darf nicht öffentlich sichtbar sein.", description: "Entwurf." },
    },
    versions: [],
  },
];

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function seedCategories() {
  for (const [index, category] of CATEGORIES.entries()) {
    const record = await db.category.upsert({
      where: { slug: category.slug },
      update: { icon: category.icon, sortOrder: index },
      create: { slug: category.slug, icon: category.icon, sortOrder: index },
    });
    for (const locale of ["de", "en"] as const) {
      await db.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: record.id, locale } },
        update: { name: category.name[locale], description: category.description[locale] },
        create: { categoryId: record.id, locale, name: category.name[locale], description: category.description[locale] },
      });
    }
  }
}

async function seedTags() {
  for (const tag of TAGS) {
    const record = await db.tag.upsert({ where: { slug: tag.slug }, update: {}, create: { slug: tag.slug } });
    for (const locale of ["de", "en"] as const) {
      await db.tagTranslation.upsert({
        where: { tagId_locale: { tagId: record.id, locale } },
        update: { name: tag.name[locale] },
        create: { tagId: record.id, locale, name: tag.name[locale] },
      });
    }
  }
}

async function clearSamples() {
  // Projekte zuerst (Restrict-Beziehung zum Ersteller); abhängige Datensätze kaskadieren.
  const { count: projects } = await db.project.deleteMany({ where: { isSample: true } });
  const { count: users } = await db.user.deleteMany({ where: { isSample: true } });
  return { projects, users };
}

async function seedSamples() {
  const categoryIds = new Map((await db.category.findMany()).map((c) => [c.slug, c.id]));
  const tags = await db.tag.findMany({ include: { translations: true } });
  const tagBySlug = new Map(tags.map((t) => [t.slug, t]));
  const reserved = new Set(categoryIds.keys());

  const creatorIds = new Map<string, string>();
  for (const creator of CREATORS) {
    // Beispielkonten haben kein Passwort (kein Account-Datensatz) und können sich nicht anmelden.
    const user = await db.user.create({
      data: {
        name: creator.displayName,
        email: `${creator.username}@example.com`,
        emailVerified: true,
        username: creator.username,
        role: "creator",
        isSample: true,
        creatorProfile: {
          create: {
            displayName: creator.displayName,
            bio: creator.bio,
            websiteUrl: `https://example.com/creators/${creator.username}`,
            verification: creator.verified ? "VERIFIED" : "UNVERIFIED",
          },
        },
      },
    });
    creatorIds.set(creator.username, user.id);
  }

  for (const project of PROJECTS) {
    if (reserved.has(project.slug)) throw new Error(`Slug "${project.slug}" ist für eine Kategorie reserviert.`);
    const creatorId = creatorIds.get(project.creator);
    const categoryId = categoryIds.get(project.category);
    if (!creatorId || !categoryId) throw new Error(`Ungültige Referenz in Projekt "${project.slug}".`);

    const status = project.status ?? "PUBLISHED";
    const latest = project.versions[0];
    const tagNames = project.tags.flatMap((slug) => tagBySlug.get(slug)?.translations.map((t) => t.name) ?? []);

    await db.project.create({
      data: {
        slug: project.slug,
        creatorId,
        categoryId,
        status,
        defaultLocale: project.defaultLocale,
        license: project.license,
        sourceUrl: `https://example.com/projects/${project.slug}`,
        gameCompatibility: project.gameCompatibility,
        coverImageUrl: project.cover,
        coverImageAlt: project.coverAlt,
        isSample: true,
        publishedAt: status === "PUBLISHED" ? daysAgo(project.publishedDaysAgo) : null,
        lastReleaseAt: latest ? daysAgo(latest.daysAgo) : null,
        translations: {
          create: Object.entries(project.texts).map(([locale, text]) => ({
            locale,
            ...text,
            searchText: buildSearchText({ ...text, tags: tagNames }),
          })),
        },
        tags: {
          create: project.tags.map((slug) => {
            const tag = tagBySlug.get(slug);
            if (!tag) throw new Error(`Unbekannter Tag "${slug}".`);
            return { tagId: tag.id };
          }),
        },
        screenshots: {
          create: (project.screenshots ?? []).map((shot, index) => ({
            imageUrl: shot.file,
            altText: shot.alt,
            sortOrder: index,
          })),
        },
        contributors: {
          create: (project.contributors ?? []).map((c, index) => ({ name: c.name, role: c.role, sortOrder: index })),
        },
        requirements: {
          create: (project.requirements ?? []).map((r, index) => ({
            name: r.name,
            url: r.path ? `https://example.com${r.path}` : null,
            pricing: r.pricing,
            sortOrder: index,
          })),
        },
        versions: {
          create: project.versions.map((version) => ({
            version: version.version,
            changelog: version.changelog,
            releasedAt: daysAgo(version.daysAgo),
            links: {
              create: (version.links ?? []).map((link, index) => {
                const parsed = parseExternalUrl(`https://example.com/downloads${link.path}`);
                if (!parsed.ok) throw new Error(`Ungültige Beispiel-URL: ${link.path}`);
                return {
                  url: parsed.url,
                  label: link.label,
                  provider: parsed.provider,
                  sourceType: link.sourceType,
                  sortOrder: index,
                };
              }),
            },
          })),
        },
      },
    });
  }
}

async function main() {
  const onlyClear = process.argv.includes("--clear-samples");

  if (onlyClear) {
    const removed = await clearSamples();
    console.log(`Beispieldaten entfernt: ${removed.projects} Projekte, ${removed.users} Benutzer.`);
    return;
  }

  await seedCategories();
  await seedTags();
  console.log(`Stammdaten: ${CATEGORIES.length} Kategorien, ${TAGS.length} Tags.`);

  if (process.env.SEED_SAMPLES === "false") {
    console.log("SEED_SAMPLES=false – Beispieldaten übersprungen.");
    return;
  }

  await clearSamples();
  await seedSamples();
  console.log(`Beispieldaten: ${CREATORS.length} Creator, ${PROJECTS.length} Projekte (inkl. 1 Entwurf).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
