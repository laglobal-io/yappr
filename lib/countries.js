// Countries for Charts and Radio. `lang` drives "Rising" (Podcast Index ranks by language, not country).
export const COUNTRIES = [
  { code: "us", name: "United States", lang: "en", langName: "English" },
  { code: "gb", name: "United Kingdom", lang: "en", langName: "English" },
  { code: "ca", name: "Canada", lang: "en", langName: "English" },
  { code: "au", name: "Australia", lang: "en", langName: "English" },
  { code: "ie", name: "Ireland", lang: "en", langName: "English" },
  { code: "nz", name: "New Zealand", lang: "en", langName: "English" },
  { code: "in", name: "India", lang: "en", langName: "English" },
  { code: "ph", name: "Philippines", lang: "en", langName: "English" },
  { code: "sg", name: "Singapore", lang: "en", langName: "English" },
  { code: "za", name: "South Africa", lang: "en", langName: "English" },
  { code: "ng", name: "Nigeria", lang: "en", langName: "English" },
  { code: "de", name: "Germany", lang: "de", langName: "German" },
  { code: "at", name: "Austria", lang: "de", langName: "German" },
  { code: "fr", name: "France", lang: "fr", langName: "French" },
  { code: "es", name: "Spain", lang: "es", langName: "Spanish" },
  { code: "mx", name: "Mexico", lang: "es", langName: "Spanish" },
  { code: "ar", name: "Argentina", lang: "es", langName: "Spanish" },
  { code: "it", name: "Italy", lang: "it", langName: "Italian" },
  { code: "nl", name: "Netherlands", lang: "nl", langName: "Dutch" },
  { code: "se", name: "Sweden", lang: "sv", langName: "Swedish" },
  { code: "br", name: "Brazil", lang: "pt", langName: "Portuguese" },
  { code: "pt", name: "Portugal", lang: "pt", langName: "Portuguese" },
  { code: "jp", name: "Japan", lang: "ja", langName: "Japanese" },
  { code: "kr", name: "South Korea", lang: "ko", langName: "Korean" },
];

export const findCountry = (code) => COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];
export const isCountry = (code) => COUNTRIES.some((c) => c.code === code);
