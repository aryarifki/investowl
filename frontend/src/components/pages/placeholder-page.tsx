"use client";
import { Wrench } from "@phosphor-icons/react";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-full mb-4">
        <Wrench size={32} className="text-blue-500" weight="bold" />
      </div>
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <p className="text-neutral-500 dark:text-neutral-400 max-w-md">{description}</p>
    </div>
  );
}
