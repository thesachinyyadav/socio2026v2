import React from "react";
import { CategoryCard } from "./CategoryCard";
import { SectionHeader } from "./SectionHeader";

interface Category {
  id: number;
  title: string;
  count: string;
  icon: string;
}

interface CategorySectionProps {
  title: string;
  categories: Category[];
}

export const CategorySection = ({
  title,
  categories,
}: CategorySectionProps) => {
  return (
    <div className="min-w-0">
      <SectionHeader title={title} link="/events" />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            title={category.title}
            count={category.count}
            icon={category.icon}
          />
        ))}
      </div>
    </div>
  );
};
