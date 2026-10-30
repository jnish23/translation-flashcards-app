import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.jordannishimura.japaneseflashcards',
  appName: 'Japanese Flashcards',
  webDir: 'dist',
  plugins: { CapacitorHttp: { enabled: true } },
};
export default config;
