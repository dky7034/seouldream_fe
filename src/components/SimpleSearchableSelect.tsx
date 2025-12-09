import React, { useState, useRef, useEffect } from "react";

export interface Option {
  // ✅ 숫자 / 문자열 / null 모두 허용
  value: number | string | null;
  label: string;
}

interface SimpleSearchableSelectProps {
  options: Option[];
  placeholder?: string;
  // ✅ 외부에서 숫자/문자열/null/undefined 모두 줄 수 있도록 확장
  value: number | string | null | undefined;
  // ✅ onChange 도 동일하게 확장
  onChange: (value: number | string | null | undefined) => void;
  isDisabled?: boolean;
  isClearable?: boolean;
}

const SimpleSearchableSelect: React.FC<SimpleSearchableSelectProps> = ({
  options,
  placeholder,
  value,
  onChange,
  isDisabled,
  isClearable = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const selectRef = useRef<HTMLDivElement>(null);

  // ✅ value 타입이 number|string|null|undefined 이므로 그대로 비교해도 됨
  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (option: Option) => {
    // ✅ option.value 가 number | string | null 이므로 그대로 전달
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    // ✅ 호출하는 쪽에서 undefined 를 “선택 해제/전체”로 처리하도록
    onChange(undefined);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={selectRef}>
      <div
        className={`w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left sm:text-sm
          ${
            isDisabled
              ? "pointer-events-none opacity-50"
              : "cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          }`}
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
      >
        <span className="block truncate">
          {selectedOption ? (
            selectedOption.label
          ) : (
            <span className="text-gray-500">{placeholder || "Select..."}</span>
          )}
        </span>

        {selectedOption && isClearable && (
          <span
            className="absolute inset-y-0 right-5 flex items-center pr-2"
            onClick={handleClear}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-gray-400 hover:text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </span>
        )}

        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg
            className="h-5 w-5 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>

      {isOpen && (
        <div className="absolute mt-1 w-full rounded-md bg-white shadow-lg z-10">
          <div className="p-2">
            <input
              type="text"
              placeholder="Search..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <ul className="max-h-60 overflow-auto">
            {filteredOptions.map((option) => (
              <li
                // ✅ value 가 null 일 수도 있으니 key 는 문자열로 변환
                key={String(option.value)}
                className="text-gray-900 cursor-default select-none relative py-2 pl-3 pr-9 hover:bg-indigo-600 hover:text-white"
                onClick={() => handleSelect(option)}
              >
                <span className="font-normal block truncate">
                  {option.label}
                </span>
                {value === option.value && (
                  <span className="text-indigo-600 absolute inset-y-0 right-0 flex items-center pr-4">
                    <svg
                      className="h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                )}
              </li>
            ))}
            {filteredOptions.length === 0 && (
              <li className="text-gray-500 cursor-default select-none relative py-2 pl-3 pr-9">
                검색 결과가 없습니다.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SimpleSearchableSelect;
