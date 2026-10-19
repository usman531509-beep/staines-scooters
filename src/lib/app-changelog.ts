// What's new in the installed app. Keep the newest entry first and add a
// short, plain-language line for every user-visible change.
export type AppRelease = {
  version: string;
  date: string; // dd/mm/yyyy
  items: string[];
};

export const APP_VERSION = "1.0.0";

export const APP_CHANGELOG: AppRelease[] = [
  {
    version: "1.0.0",
    date: "10/10/2026",
    items: [
      "First Staines Scooter release: till, sales, stock, rental, claims, expenses and reports for staff.",
    ],
  },
];
