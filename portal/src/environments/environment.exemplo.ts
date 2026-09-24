// Copie aqui a configuração do app web do seu projeto:
// Console do Firebase > Configurações do projeto > Seus apps > App da Web > SDK setup (Config).
// Esses valores não são secretos; quem protege os dados são as regras (firestore.rules e storage.rules).
export const environment = {
  /** true = usa os emuladores locais (firebase emulators:start) quando o site roda em localhost. */
  usarEmuladores: false,
  firebase: {
    apiKey: "*********",
    authDomain: "************",
    projectId: "**********",
    storageBucket: "************",
    messagingSenderId: "***********",
    appId: "************",
    measurementId: "******"
  },
};
