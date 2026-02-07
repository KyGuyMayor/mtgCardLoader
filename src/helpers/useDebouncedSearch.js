import { useState, useEffect } from 'react';

const useDebouncedSearch = (externalValue, onDebouncedChange, delay = 300) => {
  const [inputValue, setInputValue] = useState(externalValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      onDebouncedChange(inputValue);
    }, delay);
    return () => clearTimeout(timer);
  }, [inputValue, onDebouncedChange, delay]);

  useEffect(() => {
    setInputValue(externalValue);
  }, [externalValue]);

  return [inputValue, setInputValue];
};

export default useDebouncedSearch;
