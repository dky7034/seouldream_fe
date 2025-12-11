import React from "react";
import AsyncSelect from "react-select/async";

export interface SelectOption {
  value: number | string | null;
  label: string;
}

interface AsyncSearchableSelectProps {
  value: SelectOption | SelectOption[] | null;
  onChange: (value: SelectOption | SelectOption[] | null) => void;
  loadOptions: (inputValue: string) => Promise<SelectOption[]>;
  placeholder?: string;
  isClearable?: boolean;
  isMulti?: boolean;
  disabled?: boolean;
  noOptionsMessage?: (obj: { inputValue: string }) => string | null;
}

const AsyncSearchableSelect: React.FC<AsyncSearchableSelectProps> = ({
  value,
  onChange,
  loadOptions,
  placeholder,
  isClearable = true,
  isMulti = false,
  disabled = false,
  noOptionsMessage,
}) => {
  return (
    <AsyncSelect
      cacheOptions
      defaultOptions
      loadOptions={loadOptions}
      value={value}
      onChange={(option) => onChange(option as any)}
      placeholder={placeholder}
      isClearable={isClearable}
      isMulti={isMulti}
      isDisabled={disabled}
      noOptionsMessage={noOptionsMessage}
      className="mt-1"
      styles={{
        control: (provided) => ({
          ...provided,
          minHeight: "42px",
        }),
      }}
    />
  );
};

export default AsyncSearchableSelect;
