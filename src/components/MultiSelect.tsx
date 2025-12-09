import React from 'react';

interface Option {
  value: number;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  selectedValues: number[];
  onChange: (selected: number[]) => void;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ options, selectedValues, onChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    let newSelectedValues;

    if (e.target.checked) {
      newSelectedValues = [...selectedValues, value];
    } else {
      newSelectedValues = selectedValues.filter((id) => id !== value);
    }
    onChange(newSelectedValues);
  };

  return (
    <div className="space-y-2">
      {options.map((option) => (
        <div key={option.value} className="flex items-center">
          <input
            id={`checkbox-${option.value}`}
            type="checkbox"
            value={option.value}
            checked={selectedValues.includes(option.value)}
            onChange={handleChange}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label
            htmlFor={`checkbox-${option.value}`}
            className="ml-2 block text-sm text-gray-900 cursor-pointer"
          >
            {option.label}
          </label>
        </div>
      ))}
    </div>
  );
};

export default MultiSelect;