import React, { useMemo, useState } from "react";

interface Option {
  value: number;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  selectedValues: number[];
  onChange: (selected: number[]) => void;
  disabled?: boolean;
  searchable?: boolean; // 검색 지원 여부
  emptyMessage?: string; // 옵션 없을 때 메시지
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selectedValues,
  onChange,
  disabled = false,
  searchable = false,
  emptyMessage = "선택 가능한 항목이 없습니다.",
}) => {
  const [query, setQuery] = useState("");

  // 검색 기능 적용 (옵션값)
  const filteredOptions = useMemo(() => {
    if (!searchable || query.trim() === "") return options;
    return options.filter((o) =>
      o.label.toLowerCase().includes(query.trim().toLowerCase())
    );
  }, [options, query, searchable]);

  const toggleValue = (value: number) => {
    if (disabled) return;

    const isSelected = selectedValues.includes(value);
    const newSelectedValues = isSelected
      ? selectedValues.filter((id) => id !== value)
      : [...selectedValues, value];

    onChange(newSelectedValues);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    toggleValue(value);
  };

  // 🔹 옵션이 없을 때 메시지 표시
  if (filteredOptions.length === 0) {
    return (
      <div className="py-3 text-sm text-gray-400 text-center">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 🔍 검색 기능 옵션 */}
      {searchable && (
        <input
          type="text"
          value={query}
          placeholder="검색..."
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          className={`
            w-full px-3 py-2 mb-1 rounded-md border text-sm
            focus:outline-none focus:ring-indigo-500 focus:border-indigo-500
            ${disabled ? "bg-gray-100 cursor-not-allowed" : ""}
          `}
        />
      )}

      {filteredOptions.map((option) => {
        const isChecked = selectedValues.includes(option.value);
        const id = `checkbox-${option.value}`;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => toggleValue(option.value)}
            disabled={disabled}
            className={`
              w-full flex items-start gap-3 px-3 py-2 rounded-md border text-left
              transition
              ${
                isChecked
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 bg-white"
              }
              ${
                disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "active:bg-indigo-100"
              }
            `}
          >
            <input
              id={id}
              type="checkbox"
              value={option.value}
              checked={isChecked}
              disabled={disabled}
              onChange={handleCheckboxChange}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 h-5 w-5 text-indigo-600 border-gray-300 rounded"
            />
            <label
              htmlFor={id}
              className={`flex-1 text-sm break-words ${
                disabled ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {option.label}
            </label>
          </button>
        );
      })}
    </div>
  );
};

export default MultiSelect;
