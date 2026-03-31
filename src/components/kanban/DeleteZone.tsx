"use client";

import { useDroppable } from "@dnd-kit/core";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function DeleteZone() {
  const { isOver, setNodeRef } = useDroppable({
    id: "delete-zone",
  });

  const t = useTranslations("kanban");

  return (
    <div
      ref={setNodeRef}
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-200 ${
        isOver
          ? "scale-110 bg-red-500 text-white"
          : "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400"
      } rounded-full p-4 shadow-lg border-2 border-dashed ${
        isOver ? "border-white" : "border-red-400"
      }`}
    >
      <div className="flex items-center gap-2">
        <Trash2 className="h-6 w-6" />
        <span className="font-medium">
          {isOver ? t("deleteZoneDrop") : t("deleteZoneDrag")}
        </span>
      </div>
    </div>
  );
}
