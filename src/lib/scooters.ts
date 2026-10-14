import { BRAND, whatsappLink } from "@/lib/brand";

/** Rental terms shown wherever the fleet appears. */
export const RENTAL_TERMS = {
  depositPence: 20000,
  minWeeks: 4,
};

export type RentalScooter = {
  name: string;
  cc: string;
  image: string;
  weeklyPence: number;
  points: string[];
};

/** The rental fleet, cheapest first. */
export const RENTAL_FLEET: RentalScooter[] = [
  {
    name: "Honda Vision",
    cc: "110cc",
    image: "/images/fleet/honda-vision-three-quarter.webp",
    weeklyPence: 6000,
    points: ["Reliable & economical", "Perfect for commuting", "Low running costs"],
  },
  {
    name: "Honda SH Mode",
    cc: "125cc",
    image: "/images/fleet/honda-sh-mode-three-quarter.webp",
    weeklyPence: 6000,
    points: ["Light & easy to ride", "Slim step-through style", "Great in city traffic"],
  },
  {
    name: "Honda PCX",
    cc: "125cc",
    image: "/images/fleet/honda-pcx-three-quarter.webp",
    weeklyPence: 7000,
    points: ["Stylish & reliable", "Excellent fuel economy", "Ideal for work or personal use"],
  },
  {
    name: "Yamaha NMAX",
    cc: "125cc",
    image: "/images/fleet/yamaha-nmax.webp",
    weeklyPence: 7000,
    points: ["Smooth & powerful", "Great for city & long trips", "Comfortable ride"],
  },
];

export type SaleScooter = { name: string; cc: string; image: string; body: string };

/** Scooters for sale. Each comes with the delivery-ready extras below. */
export const SALE_SCOOTERS: SaleScooter[] = [
  {
    name: "Honda Vision",
    cc: "110cc",
    image: "/images/fleet/honda-vision-three-quarter.webp",
    body: "Light, economical and easy to ride a great first scooter.",
  },
  {
    name: "Honda PCX",
    cc: "125cc",
    image: "/images/fleet/honda-pcx-three-quarter.webp",
    body: "The UK's favourite 125 commuter: comfortable, frugal and reliable.",
  },
  {
    name: "Yamaha NMAX",
    cc: "125cc",
    image: "/images/fleet/yamaha-nmax.webp",
    body: "Sporty maxi-scooter comfort with smooth, punchy performance.",
  },
];

/** Extras supplied with every scooter we sell. */
export const SALE_EXTRAS = ["Pizza box", "Hot grips", "Muffs", "Phone holder"];

export const gbp = (pence: number) => `£${(pence / 100).toFixed(pence % 100 ? 2 : 0)}`;

/** WhatsApp links with a message that says what the customer is asking about. */
export const enquire = {
  rent: (name?: string) =>
    whatsappLink(`Hi ${BRAND.name}, I'd like to rent ${name ? `the ${name}` : "a scooter"}. Is it available?`),
  buy: (name?: string) =>
    whatsappLink(`Hi ${BRAND.name}, I'm interested in buying ${name ? `the ${name}` : "a scooter"}. Can you tell me more?`),
  claim: () => whatsappLink(`Hi ${BRAND.name}, I've had an accident and need help with a claim.`),
  repair: () => whatsappLink(`Hi ${BRAND.name}, I'd like to book my scooter in for a repair / service.`),
  general: () => whatsappLink(`Hi ${BRAND.name}, I have a question.`),
};
