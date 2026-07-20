"use client";

import { useState } from "react";
import { ContactFormModal } from "@/components/ContactFormModal";

const buttonClassName =
  "inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-base font-semibold text-stone-100 backdrop-blur-sm transition hover:border-white/35 hover:bg-white/10";

export function GetInTouchButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={buttonClassName} onClick={() => setOpen(true)}>
        Contact Us
      </button>
      <ContactFormModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
