"use client";

import { motion } from "framer-motion";

export function AuthBackground(): JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="bg-gradient-lumi absolute inset-[-20%] rounded-full opacity-30 blur-3xl"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 16, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-10 top-10 h-40 w-40 rounded-2xl border border-white/20 bg-white/5"
        animate={{ y: [0, 20, 0], rotate: [0, 6, -6, 0] }}
        transition={{ duration: 12, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
    </div>
  );
}
