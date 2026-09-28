"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Idea } from "@/lib/domain/types";
import { IdeaForm } from "./IdeaForm";
import type { ContentOptions } from "./shared";

export function IdeaEditToggle({ idea, options }: { idea: Idea; options: ContentOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}><Pencil className="size-4" /> Ubah</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <IdeaForm options={options} idea={idea} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
