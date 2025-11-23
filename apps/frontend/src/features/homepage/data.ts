export interface FeaturedProduct {
  id: string;
  name: string;
  description: string;
  price: string;
  badge?: string;
  image: string;
  metrics?: string;
}

export interface CategoryTile {
  id: string;
  name: string;
  href: string;
  image: string;
  productCount: number;
}

export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  avatar: string;
  rating: number;
}

export const featuredProducts: FeaturedProduct[] = [
  {
    id: "neon-runner",
    name: "Neon Runner Jacket",
    description: "Windproof shell with adaptive warmth and reflective seams.",
    price: "₺2.450",
    badge: "Yeni",
    image: "https://res.cloudinary.com/demo/image/upload/v1710500000/ecommerce/jacket.jpg",
    metrics: "↑ 18% LTV uplift",
  },
  {
    id: "lumi-sneaker",
    name: "Lumi Flux Sneaker",
    description: "Lightweight knit upper, cloud outsole, carbon-neutral build.",
    price: "₺3.250",
    badge: "Çok Satan",
    image: "https://res.cloudinary.com/demo/image/upload/v1710500000/ecommerce/sneaker.jpg",
    metrics: "↓ 22% returns",
  },
  {
    id: "signal-backpack",
    name: "Signal Backpack",
    description: "Magnetic pockets, waterproof coating, TSA-ready laptop bay.",
    price: "₺1.890",
    badge: "Stokta",
    image: "https://res.cloudinary.com/demo/image/upload/v1710500000/ecommerce/backpack.jpg",
    metrics: "↑ 31% AOV lift",
  },
  {
    id: "aurora-watch",
    name: "Aurora Watch",
    description: "Sapphire glass, 10-day battery, biometric ready.",
    price: "₺6.500",
    badge: "Öne Çıkan",
    image: "https://res.cloudinary.com/demo/image/upload/v1710500000/ecommerce/watch.jpg",
    metrics: "↑ 9% CVR",
  },
];

export const categoryTiles: CategoryTile[] = [
  {
    id: "outerwear",
    name: "Outerwear",
    href: "/products?category=outerwear",
    image: "https://res.cloudinary.com/demo/image/upload/v1710500000/ecommerce/outerwear.jpg",
    productCount: 128,
  },
  {
    id: "sneakers",
    name: "Sneakers",
    href: "/products?category=sneakers",
    image: "https://res.cloudinary.com/demo/image/upload/v1710500000/ecommerce/sneakers.jpg",
    productCount: 96,
  },
  {
    id: "bags",
    name: "Bags",
    href: "/products?category=bags",
    image: "https://res.cloudinary.com/demo/image/upload/v1710500000/ecommerce/bags.jpg",
    productCount: 74,
  },
  {
    id: "accessories",
    name: "Accessories",
    href: "/products?category=accessories",
    image: "https://res.cloudinary.com/demo/image/upload/v1710500000/ecommerce/accessories.jpg",
    productCount: 58,
  },
  {
    id: "athleisure",
    name: "Athleisure",
    href: "/products?category=athleisure",
    image: "https://res.cloudinary.com/demo/image/upload/v1710500000/ecommerce/athleisure.jpg",
    productCount: 83,
  },
  {
    id: "limited",
    name: "Limited Drops",
    href: "/products?category=limited",
    image: "https://res.cloudinary.com/demo/image/upload/v1710500000/ecommerce/limited.jpg",
    productCount: 22,
  },
];

export const testimonials: Testimonial[] = [
  {
    id: "elin",
    quote:
      "Lumi'nin vitrini; ışık, cam ve performansın bir araya geldiği modern bir deneyim. Ekip, KPI'larıma takıntılı derecede bağlı.",
    name: "Elin Öztürk",
    role: "Ecom Director, Nova",
    avatar: "https://res.cloudinary.com/demo/image/upload/v1710500000/ecommerce/avatar1.jpg",
    rating: 5,
  },
  {
    id: "darin",
    quote:
      "Checkout akışındaki mikro animasyonlar ve akışkan grid yapısı, mobil LCP'yi gözle görülür şekilde iyileştirdi.",
    name: "Darin Karaca",
    role: "Head of Product, Vertex",
    avatar: "https://res.cloudinary.com/demo/image/upload/v1710500000/ecommerce/avatar2.jpg",
    rating: 4.5,
  },
  {
    id: "selin",
    quote:
      "Deneme.html estetiğini gerçek bir vitrinde görmek büyüleyici. Takım, tasarım sistemine sadık kalırken hızla teslim etti.",
    name: "Selin Aydın",
    role: "CX Lead, Lumen",
    avatar: "https://res.cloudinary.com/demo/image/upload/v1710500000/ecommerce/avatar3.jpg",
    rating: 5,
  },
];
